import { useEffect, useRef, useState } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export function useHandTracking(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [isReady, setIsReady] = useState(false);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const pinchDistRef = useRef<number>(1);
  const cursorRef = useRef<{ x: number; y: number; isPinching: boolean; lastSeen: number }>({
    x: -1,
    y: -1,
    isPinching: false,
    lastSeen: 0,
  });

  useEffect(() => {
    let active = true;

    async function initMediaPipe() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        
        if (!active) return;
  
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        handLandmarkerRef.current = handLandmarker;
        setIsReady(true);
      } catch (err) {
        console.warn("MediaPipe initialization fallback to mouse mode:", err);
      }
    }

    initMediaPipe();

    return () => {
      active = false;
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!isReady || !videoRef.current) return;

    let stream: MediaStream | null = null;
    let animationFrameId: number;
    let lastDetectTime = 0;

    async function setupCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
        });
        if (videoRef.current) {
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
      if (!videoRef.current || !handLandmarkerRef.current) return;

      const now = performance.now();
      // Throttle inference to ~30 FPS (33ms) to prevent GPU main thread bottleneck
      if (now - lastDetectTime >= 33 && videoRef.current.readyState >= 2) {
        lastDetectTime = now;
        try {
          const results = handLandmarkerRef.current.detectForVideo(videoRef.current, now);
          
          if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];
            const indexTip = landmarks[8];
            const thumbTip = landmarks[4];

            // Map webcam space to screen space (mirror x-axis)
            const x = 1 - indexTip.x;
            const y = indexTip.y;
            
            // Calculate 2D pinch distance
            const dx = indexTip.x - thumbTip.x;
            const dy = indexTip.y - thumbTip.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            pinchDistRef.current = dist;
            cursorRef.current = {
              x,
              y,
              isPinching: dist < 0.08, // Calibrated sensitive pinch threshold
              lastSeen: now,
            };
          } else {
            // Clear hand cursor immediately when hand is outside frame
            cursorRef.current = {
              x: -1,
              y: -1,
              isPinching: false,
              lastSeen: 0,
            };
          }
        } catch {
          // Ignore frame skip
        }
      }

      animationFrameId = requestAnimationFrame(detectFrame);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isReady, videoRef]);

  return { isReady, cursorRef };
}
