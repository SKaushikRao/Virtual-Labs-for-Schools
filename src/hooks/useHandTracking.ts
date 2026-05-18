import { useEffect, useRef, useState } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export function useHandTracking(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [isReady, setIsReady] = useState(false);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const pinchDistRef = useRef<number>(1);
  const cursorRef = useRef<{ x: number, y: number, isPinching: boolean }>({ x: 0, y: 0, isPinching: false });

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
        console.error("Error initializing MediaPipe:", err);
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
      } catch (err) {
        console.error("Camera access failed", err);
      }
    }

    setupCamera();

    function detectFrame() {
      if (!videoRef.current || !handLandmarkerRef.current) return;

      const results = handLandmarkerRef.current.detectForVideo(videoRef.current, performance.now());
      
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
        
        // Expose data
        pinchDistRef.current = dist;
        cursorRef.current = {
          x,
          y,
          isPinching: dist < 0.05
        };
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
