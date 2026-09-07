import React, { useEffect, useRef, useState } from 'react';
import { HandData } from '../../hooks/useHandTracking';
import { Sparkles, Hand, Eye, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '../../utils/cn';

interface WebcamVisionOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isReady?: boolean;
  handsRef?: React.MutableRefObject<HandData[]>;
  lastGesture?: string | null;
  className?: string;
  showHelperHint?: boolean;
}

// MediaPipe 21 Hand Landmark connections
const HAND_CONNECTIONS: [number, number][] = [
  // Palm base
  [0, 1], [0, 5], [5, 9], [9, 13], [13, 17], [17, 0],
  // Thumb
  [1, 2], [2, 3], [3, 4],
  // Index
  [5, 6], [6, 7], [7, 8],
  // Middle
  [9, 10], [10, 11], [11, 12],
  // Ring
  [13, 14], [14, 15], [15, 16],
  // Pinky
  [17, 18], [18, 19], [19, 20],
];

// Palm polygon indices for mesh fill
const PALM_POLYGON = [0, 1, 2, 5, 9, 13, 17];

export const WebcamVisionOverlay: React.FC<WebcamVisionOverlayProps> = ({
  videoRef,
  isReady = false,
  handsRef,
  lastGesture,
  className,
  showHelperHint = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [hasDetectedHands, setHasDetectedHands] = useState(false);
  const [isHoldingVSign, setIsHoldingVSign] = useState(false);

  // Render loop to draw MediaPipe skeleton & palm mesh on canvas
  useEffect(() => {
    let animId: number;

    const renderSkeleton = () => {
      const canvas = canvasRef.current;
      if (canvas && handsRef) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const rect = canvas.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          const displayWidth = Math.round(rect.width * dpr);
          const displayHeight = Math.round(rect.height * dpr);

          if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
          }

          ctx.save();
          ctx.scale(dpr, dpr);
          ctx.clearRect(0, 0, rect.width, rect.height);

          const hands = handsRef.current || [];
          setHasDetectedHands(hands.length > 0);

          let vSignActive = false;

          for (const hand of hands) {
            const lms = hand.landmarks;
            if (!lms || lms.length < 21) continue;

            const isPinching = hand.isPinching;
            const isVSign = !!hand.isVSign;
            if (isVSign) vSignActive = true;

            // 1. Draw Palm Mesh Polygon Fill
            ctx.beginPath();
            const firstPt = lms[PALM_POLYGON[0]];
            ctx.moveTo(firstPt.x * rect.width, firstPt.y * rect.height);
            for (let i = 1; i < PALM_POLYGON.length; i++) {
              const pt = lms[PALM_POLYGON[i]];
              ctx.lineTo(pt.x * rect.width, pt.y * rect.height);
            }
            ctx.closePath();
            ctx.fillStyle = isVSign
              ? 'rgba(16, 185, 129, 0.22)'
              : isPinching
              ? 'rgba(192, 132, 252, 0.22)'
              : 'rgba(0, 242, 255, 0.14)';
            ctx.fill();

            // 2. Draw Hand Skeleton Bones
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
              const start = lms[startIdx];
              const end = lms[endIdx];
              if (!start || !end) continue;

              const isThumbOrIndex =
                (startIdx <= 4 && endIdx <= 4) ||
                (startIdx >= 5 && startIdx <= 8 && endIdx >= 5 && endIdx <= 8);

              const isIndexOrMiddle =
                (startIdx >= 5 && startIdx <= 8 && endIdx >= 5 && endIdx <= 8) ||
                (startIdx >= 9 && startIdx <= 12 && endIdx >= 9 && endIdx <= 12);

              ctx.beginPath();
              ctx.moveTo(start.x * rect.width, start.y * rect.height);
              ctx.lineTo(end.x * rect.width, end.y * rect.height);

              if (isVSign && isIndexOrMiddle) {
                ctx.strokeStyle = '#34d399';
                ctx.shadowColor = '#10b981';
                ctx.shadowBlur = 10;
              } else if (isPinching && isThumbOrIndex) {
                ctx.strokeStyle = '#e879f9';
                ctx.shadowColor = '#d946ef';
                ctx.shadowBlur = 8;
              } else {
                ctx.strokeStyle = '#00f2ff';
                ctx.shadowColor = '#00f2ff';
                ctx.shadowBlur = 6;
              }
              ctx.stroke();
            }

            // 3. Draw Landmark Nodes
            for (let i = 0; i < lms.length; i++) {
              const lm = lms[i];
              const x = lm.x * rect.width;
              const y = lm.y * rect.height;

              const isTip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;

              ctx.beginPath();
              ctx.arc(x, y, isTip ? 4.5 : 2.5, 0, Math.PI * 2);

              if (isTip) {
                if (isVSign && (i === 8 || i === 12)) {
                  ctx.fillStyle = '#10b981';
                } else if (isPinching && (i === 4 || i === 8)) {
                  ctx.fillStyle = '#f43f5e';
                } else {
                  ctx.fillStyle = '#38bdf8';
                }
                ctx.shadowColor = ctx.fillStyle;
                ctx.shadowBlur = 10;
                ctx.fill();

                // Outer halo ring for tips
                ctx.beginPath();
                ctx.arc(x, y, 7, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.lineWidth = 1;
                ctx.stroke();
              } else {
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = '#00f2ff';
                ctx.shadowBlur = 4;
                ctx.fill();
              }
            }

            // 4. Pinch indicator highlight between thumb & index
            if (isPinching) {
              const thumb = lms[4];
              const index = lms[8];
              const midX = ((thumb.x + index.x) / 2) * rect.width;
              const midY = ((thumb.y + index.y) / 2) * rect.height;

              ctx.beginPath();
              ctx.arc(midX, midY, 12, 0, Math.PI * 2);
              ctx.strokeStyle = '#ec4899';
              ctx.lineWidth = 2;
              ctx.shadowColor = '#ec4899';
              ctx.shadowBlur = 12;
              ctx.stroke();
            }
          }

          setIsHoldingVSign(vSignActive);
          ctx.restore();
        }
      }

      animId = requestAnimationFrame(renderSkeleton);
    };

    animId = requestAnimationFrame(renderSkeleton);
    return () => cancelAnimationFrame(animId);
  }, [handsRef]);

  if (isMinimized) {
    return (
      <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-2.5 flex items-center justify-between shrink-0 pointer-events-auto shadow-2xl">
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', isReady ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400')} />
          <span className="text-[10px] font-mono uppercase tracking-wider text-white/70">Vision Tracker</span>
        </div>
        <button
          onClick={() => setIsMinimized(false)}
          className="p-1 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-all"
          title="Maximize Camera HUD"
        >
          <Maximize2 size={13} />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative bg-[#070914]/90 backdrop-blur-xl rounded-2xl border border-cyan-500/30 overflow-hidden shrink-0 pointer-events-auto shadow-[0_0_25px_rgba(0,242,255,0.15)] flex flex-col',
        className || 'w-full h-44'
      )}
    >
      {/* Top Header Bar */}
      <div className="h-7 px-3 bg-white/5 border-b border-white/10 flex items-center justify-between z-10 select-none">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              isHoldingVSign
                ? 'bg-emerald-400 animate-ping'
                : isReady && hasDetectedHands
                ? 'bg-cyan-400'
                : 'bg-amber-400 animate-pulse'
            )}
          />
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-300">
            {isHoldingVSign
              ? '✌️ V-Sign Active'
              : isReady
              ? (hasDetectedHands ? 'Hands Tracking (60fps)' : 'Vision Active')
              : 'Camera Initializing'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {lastGesture === 'v-swipe-left' && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 border border-emerald-400/60 text-[9px] font-mono text-emerald-200 font-bold animate-pulse">
              ✌️ V-Swipe Left (Open)
            </span>
          )}
          {lastGesture === 'v-swipe-right' && (
            <span className="px-2 py-0.5 rounded-full bg-rose-500/30 border border-rose-400/60 text-[9px] font-mono text-rose-200 font-bold animate-pulse">
              ✌️ V-Swipe Right (Close)
            </span>
          )}
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 hover:bg-white/10 rounded-md text-white/50 hover:text-white transition-all"
            title="Minimize Camera Feed"
          >
            <Minimize2 size={12} />
          </button>
        </div>
      </div>

      {/* Video Stream + Skeleton Mesh Canvas Area */}
      <div className="relative flex-1 bg-black/40 overflow-hidden flex items-center justify-center">
        <video
          ref={videoRef}
          playsInline
          muted
          className="w-full h-full object-cover scale-x-[-1] opacity-60"
        />

        {/* Real-time Skeleton & Mesh Overlay */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        />

        {/* Cyber Corner Reticles */}
        <div className="absolute top-1.5 left-1.5 w-3 h-3 border-t-2 border-l-2 border-cyan-400/60 pointer-events-none" />
        <div className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 border-cyan-400/60 pointer-events-none" />
        <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b-2 border-l-2 border-cyan-400/60 pointer-events-none" />
        <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b-2 border-r-2 border-cyan-400/60 pointer-events-none" />

        {/* No Hands Hint Prompt Overlay */}
        {!hasDetectedHands && isReady && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20">
            <div className="px-3 py-1 rounded-full bg-black/60 border border-white/10 backdrop-blur-sm text-[10px] font-mono text-white/70 flex items-center gap-1.5">
              <Hand size={12} className="text-cyan-400 animate-pulse" />
              <span>Hold ✌️ (V-Sign) & swipe to toggle AI Mentor</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Gesture Helper Footer */}
      {showHelperHint && (
        <div className="h-6 px-3 bg-white/5 border-t border-white/10 flex items-center justify-between text-[9px] font-mono text-white/50 select-none z-10">
          <span className="flex items-center gap-1 text-cyan-300/80">
            <span>✌️</span>
            <span>V-Swipe ← Open / → Close</span>
          </span>
          <span className="text-white/40">🤏 Pinch: Grab</span>
        </div>
      )}
    </div>
  );
};
