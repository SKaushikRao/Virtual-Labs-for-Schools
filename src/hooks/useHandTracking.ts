import { useEffect, useRef, useState } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { useAppStore } from '../store/useAppStore';
import { labAudio } from '../utils/LabAudio';

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
  isVSign?: boolean;
  pinchDistance: number;
  center: { x: number; y: number; z: number };
}

const PINCH_ENGAGE_THRESHOLD = 0.068;
const PINCH_RELEASE_THRESHOLD = 0.088;
let activeDelegate: "GPU" | "CPU" = "GPU";

// Singleton cache for MediaPipe HandLandmarker to avoid WebGL / WASM resource thrashing
let sharedHandLandmarkerPromise: Promise<HandLandmarker> | null = null;

async function getSharedHandLandmarker(): Promise<HandLandmarker> {
  if (!sharedHandLandmarkerPromise) {
    sharedHandLandmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );
      
      try {
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        activeDelegate = "GPU";
        return landmarker;
      } catch (gpuErr) {
        console.warn("GPU delegate initialization failed, falling back to CPU:", gpuErr);
        const landmarker = await HandLandmarker.createFromOptions(vision, {
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
        activeDelegate = "CPU";
        return landmarker;
      }
    })();
  }
  return sharedHandLandmarkerPromise;
}

/**
 * Checks if the hand is displaying a Peace / Victory (V) sign:
 * - Index and Middle fingers extended
 * - Ring and Pinky fingers curled/folded towards palm
 * - Not pinching
 */
export function isPeaceVSign(landmarks: { x: number; y: number; z: number }[]): boolean {
  if (!landmarks || landmarks.length < 21) return false;

  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexPip = landmarks[6];
  const indexTip = landmarks[8];
  const middlePip = landmarks[10];
  const middleTip = landmarks[12];
  const ringMcp = landmarks[13];
  const ringPip = landmarks[14];
  const ringTip = landmarks[16];
  const pinkyMcp = landmarks[17];
  const pinkyPip = landmarks[18];
  const pinkyTip = landmarks[20];

  const distSq = (p1: { x: number; y: number; z?: number }, p2: { x: number; y: number; z?: number }) => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = (p1.z || 0) - (p2.z || 0);
    return dx * dx + dy * dy + dz * dz;
  };

  // 1. Index and Middle tips extended farther from wrist than PIP
  const isIndexExtended = distSq(indexTip, wrist) > distSq(indexPip, wrist) * 1.25;
  const isMiddleExtended = distSq(middleTip, wrist) > distSq(middlePip, wrist) * 1.25;

  // 2. Ring and Pinky folded/curled towards palm
  const isRingFolded =
    distSq(ringTip, ringMcp) < 0.03 || distSq(ringTip, wrist) < distSq(ringPip, wrist) * 1.2;
  const isPinkyFolded =
    distSq(pinkyTip, pinkyMcp) < 0.03 || distSq(pinkyTip, wrist) < distSq(pinkyPip, wrist) * 1.2;

  // 3. Thumb is not pinching index
  const isNotPinching = distSq(thumbTip, indexTip) > 0.006;

  return isIndexExtended && isMiddleExtended && isRingFolded && isPinkyFolded && isNotPinching;
}

export function useHandTracking(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [isReady, setIsReady] = useState(false);
  const [lastGesture, setLastGesture] = useState<string | null>(null);

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

  // V-Sign (Peace symbol) trajectory history for bidirectional swipe detection
  const vSignTrajectoryRef = useRef<{ x: number; y: number; time: number }[]>([]);
  const lastSwipeTimestampRef = useRef<number>(0);
  const gestureClearTimerRef = useRef<number | null>(null);

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
      if (gestureClearTimerRef.current) clearTimeout(gestureClearTimerRef.current);
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
      // Allow full 60 FPS real-time tracking when GPU delegate is active; throttle only on CPU fallback
      const minInterval = activeDelegate === "GPU" ? 0 : 33;
      if (now - lastInferenceTime.current >= minInterval) {
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

                const isVSign = isPeaceVSign(mapped);

                detectedHands.push({
                  landmarks: mapped,
                  handedness,
                  isPinching,
                  isVSign,
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

              // --- Two-Finger Peace / "V" Symbol Swipe Gesture Detection ---
              if (primary.isVSign && !primary.isPinching) {
                const handCenter = primary.center;
                vSignTrajectoryRef.current.push({
                  x: handCenter.x,
                  y: handCenter.y,
                  time: now,
                });

                // Keep trajectory window of last 450ms
                vSignTrajectoryRef.current = vSignTrajectoryRef.current.filter(
                  (p) => now - p.time <= 450
                );

                if (vSignTrajectoryRef.current.length >= 3) {
                  const oldest = vSignTrajectoryRef.current[0];
                  const newest = vSignTrajectoryRef.current[vSignTrajectoryRef.current.length - 1];
                  const dt = (newest.time - oldest.time) / 1000;
                  const deltaX = newest.x - oldest.x; // mapped x: 0 is left, 1 is right
                  const deltaY = newest.y - oldest.y;

                  // Condition: horizontal swipe with peace / V sign within 80-450ms
                  if (dt >= 0.08 && dt <= 0.45 && Math.abs(deltaY) < 0.25) {
                    // 1. Right to Left Swipe (deltaX < -0.15) -> OPEN AI MENTOR
                    if (deltaX < -0.15 && now - lastSwipeTimestampRef.current > 1200) {
                      lastSwipeTimestampRef.current = now;
                      console.log('[Hand Tracking] ✌️ V-Sign Swipe Right-to-Left -> OPEN AI Mentor');

                      try {
                        labAudio.playGrabSound();
                      } catch {}

                      useAppStore.getState().setMentorOpen(true);

                      setLastGesture('v-swipe-left');
                      if (gestureClearTimerRef.current) clearTimeout(gestureClearTimerRef.current);
                      gestureClearTimerRef.current = window.setTimeout(() => {
                        setLastGesture(null);
                      }, 2200);

                      vSignTrajectoryRef.current = [];
                    }
                    // 2. Left to Right Swipe (deltaX > 0.15) -> CLOSE AI MENTOR
                    else if (deltaX > 0.15 && now - lastSwipeTimestampRef.current > 1200) {
                      lastSwipeTimestampRef.current = now;
                      console.log('[Hand Tracking] ✌️ V-Sign Swipe Left-to-Right -> CLOSE AI Mentor');

                      try {
                        labAudio.playGrabSound();
                      } catch {}

                      useAppStore.getState().setMentorOpen(false);

                      setLastGesture('v-swipe-right');
                      if (gestureClearTimerRef.current) clearTimeout(gestureClearTimerRef.current);
                      gestureClearTimerRef.current = window.setTimeout(() => {
                        setLastGesture(null);
                      }, 2200);

                      vSignTrajectoryRef.current = [];
                    }
                  }
                }
              } else {
                // If V-sign is released, clear recent trajectory
                if (vSignTrajectoryRef.current.length > 0) {
                  vSignTrajectoryRef.current = [];
                }
              }
            } else {
              handsRef.current = [];
              vSignTrajectoryRef.current = [];
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

  return { isReady, handStateRef, cursorRef: handStateRef, handsRef, lastGesture };
}
