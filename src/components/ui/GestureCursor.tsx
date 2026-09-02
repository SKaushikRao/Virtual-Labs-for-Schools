import React, { useEffect, useRef } from 'react';

interface GestureCursorProps {
  getPointer: () => { x: number; y: number; active: boolean };
}

export const GestureCursor: React.FC<GestureCursorProps> = ({ getPointer }) => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const trailCanvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<{ x: number; y: number }[]>([]);

  useEffect(() => {
    let animId: number;

    const canvas = trailCanvasRef.current;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    const handleResize = () => {
      if (trailCanvasRef.current) {
        trailCanvasRef.current.width = window.innerWidth;
        trailCanvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);

    const render = () => {
      const ptr = getPointer();
      const px = ptr.x * window.innerWidth;
      const py = ptr.y * window.innerHeight;

      // Update Cursor position & visual state
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%) scale(${ptr.active ? 0.8 : 1})`;
        cursorRef.current.setAttribute('data-pinching', ptr.active ? 'true' : 'false');
      }

      // Record trailing history
      historyRef.current.push({ x: px, y: py });
      if (historyRef.current.length > 8) {
        historyRef.current.shift();
      }

      // Draw glowing motion trail
      if (trailCanvasRef.current) {
        const ctx = trailCanvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, trailCanvasRef.current.width, trailCanvasRef.current.height);

          if (historyRef.current.length > 2) {
            ctx.beginPath();
            ctx.moveTo(historyRef.current[0].x, historyRef.current[0].y);
            for (let i = 1; i < historyRef.current.length; i++) {
              const xc = (historyRef.current[i].x + historyRef.current[i - 1].x) / 2;
              const yc = (historyRef.current[i].y + historyRef.current[i - 1].y) / 2;
              ctx.quadraticCurveTo(historyRef.current[i - 1].x, historyRef.current[i - 1].y, xc, yc);
            }

            ctx.strokeStyle = ptr.active ? 'rgba(0, 255, 120, 0.45)' : 'rgba(0, 242, 255, 0.35)';
            ctx.lineWidth = ptr.active ? 4 : 2.5;
            ctx.lineCap = 'round';
            ctx.shadowColor = ptr.active ? '#00ff88' : '#00f2ff';
            ctx.shadowBlur = 8;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [getPointer]);

  return (
    <>
      <canvas
        ref={trailCanvasRef}
        className="fixed inset-0 pointer-events-none z-[99] will-change-transform"
      />
      <div
        ref={cursorRef}
        className="fixed top-0 left-0 z-[100] pointer-events-none will-change-transform transition-colors duration-150 flex items-center justify-center"
      >
        {/* Outer reticle / Hand pinch indicator */}
        <div className="relative flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-400/80 bg-cyan-400/10 shadow-[0_0_20px_rgba(0,242,255,0.6)] flex items-center justify-center backdrop-blur-[2px] transition-all duration-150 data-[pinching=true]:border-emerald-400 data-[pinching=true]:bg-emerald-400/30 data-[pinching=true]:shadow-[0_0_25px_rgba(0,255,136,0.8)] data-[pinching=true]:scale-90">
            {/* Gesture Pinch/Hand Graphic */}
            <svg
              className="w-5 h-5 text-cyan-200 transition-transform duration-150"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
              <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
              <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
              <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
            </svg>
          </div>
          {/* Center pinpoint */}
          <div className="absolute w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_#ffffff]" />
        </div>
      </div>
    </>
  );
};
