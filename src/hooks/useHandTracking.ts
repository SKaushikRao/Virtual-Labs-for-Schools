import { useEffect, useRef, useState } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export interface HandTrackingState {
  x: number;
  y: number;
  z: number;
  isPinching: boolean;
  pinchDistance: number;
  confidence: number;
  lastSeen: number;
}

export interface HandData {
  landmarks: { x: number; y: number; z: number }[];
  handedness: 'Left' | 'Right';
  isPinching: boolean;
  pinchDistance: number;
  center: { x: number; y: number; z: number };
}

const PINCH_ENGAGE_THRESHOLD = 0.045;
const PINCH_RELEASE_THRESHOLD = 0.075;
const INFERENCE_INTERVAL_MS = 33; // 30 FPS inference to prevent GPU/WebGL congestion

// Singleton cache for MediaPipe HandLandmarker to avoid WebGL / WASM resource thrashing
let sharedHandLandmarkerPromise: Promise<HandLandmarker> | null = null;

async function getSharedHandLandmarker(): Promise<HandLandmarker> {
  if (!sharedHandLandmarkerPromise) {
    sharedHandLandmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );
      
      return await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "CPU"
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
    })();
  }
  return sharedHandLandmarkerPromise;
}

export function useHandTracking(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [isReady, setIsReady] = useState(false);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const handStateRef = useRef<HandTrackingState>({
    x: -1,
    y: -1,
    z: 0,
    isPinching: false,
    pinchDistance: 1,
    confidence: 0,
    lastSeen: 0,
  });
  const handsRef = useRef<HandData[]>([]);
  const lastInferenceTime = useRef<number>(0);

  useEffect(() => {
    let active = true;

    async function initMediaPipe() {
      try {
        const handLandmarker = await getSharedHandLandmarker();
        if (!active) return;
        handLandmarkerRef.current = handLandmarker;
        setIsReady(true);
      } catch (err) {
        console.warn("MediaPipe initialization fallback to mouse mode:", err);
      }
    }

    initMediaPipe();

    return () => {
      active = false;
      handLandmarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isReady || !videoRef.current) return;

    let stream: MediaStream | null = null;
    let animationFrameId: number;
    let isRunning = true;

    async function setupCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
        });
        if (videoRef.current && isRunning) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          detectFrame();
        }
      } catch {
        // Fallback to mouse mode gracefully without crash
      }
    }

    setupCamera();

    function detectFrame() {
      if (!isRunning || !videoRef.current || !handLandmarkerRef.current) return;

      const now = performance.now();

      // Throttle heavy neural inference to ~30 FPS to avoid WebGL / GPU frame queue stalls
      if (now - lastInferenceTime.current >= INFERENCE_INTERVAL_MS) {
        lastInferenceTime.current = now;

        if (videoRef.current.readyState >= 2) {
          try {
            const results = handLandmarkerRef.current.detectForVideo(videoRef.current, now);
            
            if (results && results.landmarks && results.landmarks.length > 0) {
              const detectedHands: HandData[] = [];

              for (let i = 0; i < results.landmarks.length; i++) {
                const rawLandmarks = results.landmarks[i];
                const mapped = rawLandmarks.map((lm) => ({
                  x: 1 - lm.x,
                  y: lm.y,
                  z: lm.z || 0,
                }));

                const indexTip = mapped[8];
                const thumbTip = mapped[4];
                const middleMcp = mapped[9];

                const dx = indexTip.x - thumbTip.x;
                const dy = indexTip.y - thumbTip.y;
                const dz = indexTip.z - thumbTip.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                const prevHand = handsRef.current[i];
                const isPinching = prevHand && prevHand.isPinching
                  ? dist < PINCH_RELEASE_THRESHOLD
                  : dist < PINCH_ENGAGE_THRESHOLD;

                let handedness: 'Left' | 'Right' = 'Right';
                if (results.handedness && results.handedness[i] && results.handedness[i][0]) {
                  const catName = results.handedness[i][0].categoryName || results.handedness[i][0].displayName;
                  handedness = catName === 'Left' ? 'Left' : 'Right';
                }

                detectedHands.push({
                  landmarks: mapped,
                  handedness,
                  isPinching,
                  pinchDistance: dist,
                  center: middleMcp || mapped[0],
                });
              }

              handsRef.current = detectedHands;

              const primary = detectedHands[0];
              const pIndex = primary.landmarks[8];
              handStateRef.current.x = pIndex.x;
              handStateRef.current.y = pIndex.y;
              handStateRef.current.z = pIndex.z;
              handStateRef.current.pinchDistance = primary.pinchDistance;
              handStateRef.current.isPinching = primary.isPinching;
              handStateRef.current.confidence = 1;
              handStateRef.current.lastSeen = now;
            } else {
              handsRef.current = [];
              handStateRef.current.x = -1;
              handStateRef.current.y = -1;
              handStateRef.current.isPinching = false;
              handStateRef.current.pinchDistance = 1;
              handStateRef.current.confidence = 0;
            }
          } catch {
            // Gracefully ignore frame drop
          }
        }
      }

      if (isRunning) {
        animationFrameId = requestAnimationFrame(detectFrame);
      }
    }

    return () => {
      isRunning = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isReady, videoRef]);

  return { isReady, handStateRef, cursorRef: handStateRef, handsRef };
}
