import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store/useAppStore';
import { labAudio } from '../utils/LabAudio';
import { Sparkles, Hand, CheckCircle2, RotateCcw, X } from 'lucide-react';

export const GestureTutorial: React.FC = () => {
  const isTutorialOpen = useAppStore((state) => state.isTutorialOpen);
  const setTutorialOpen = useAppStore((state) => state.setTutorialOpen);
  const setTutorialCompleted = useAppStore((state) => state.setTutorialCompleted);

  const [stage, setStage] = useState<'explain' | 'practice' | 'confirm'>('explain');
  const [draggedToTarget, setDraggedToTarget] = useState(false);
  const [flaskPos, setFlaskPos] = useState({ x: 60, y: 120 });
  const [isDragging, setIsDragging] = useState(false);

  if (!isTutorialOpen) return null;

  const handleFinish = () => {
    labAudio.playSuccessChime();
    setTutorialCompleted(true);
    setTutorialOpen(false);
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    labAudio.playGrabSound();
  };

  const handleDragMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;
    setFlaskPos({ x, y });

    // Target is around (260, 120)
    const dist = Math.hypot(x - 260, y - 120);
    if (dist < 50 && !draggedToTarget) {
      setDraggedToTarget(true);
      setIsDragging(false);
      labAudio.playSuccessChime();
      setTimeout(() => setStage('confirm'), 600);
    }
  };

  const handleDragEnd = () => {
    if (isDragging && !draggedToTarget) {
      setIsDragging(false);
      setFlaskPos({ x: 60, y: 120 });
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 select-none"
      >
        <div className="relative w-full max-w-xl bg-gradient-to-b from-[#13132b] to-[#0a0a18] border border-white/20 rounded-3xl shadow-[0_0_50px_rgba(78,68,255,0.3)] overflow-hidden flex flex-col p-6">
          {/* Close button */}
          <button
            onClick={() => setTutorialOpen(false)}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer z-10"
          >
            <X size={18} />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-[#4e44ff]/20 border border-[#4e44ff]/40 flex items-center justify-center text-cyan-300">
              <Hand size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display text-white">How to Control the 3D Lab</h2>
              <p className="text-xs text-white/50">Webcam pinch gestures or standard mouse drag & drop</p>
            </div>
          </div>

          {/* Stepper Tabs */}
          <div className="flex gap-2 mb-6 border-b border-white/10 pb-3">
            {[
              { id: 'explain', label: '1. Hand Gestures' },
              { id: 'practice', label: '2. Quick Practice' },
              { id: 'confirm', label: '3. Ready!' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setStage(s.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                  stage === s.id
                    ? 'bg-[#4e44ff] text-white shadow-[0_0_15px_#4e44ff]'
                    : 'bg-white/5 text-white/60 hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Content Body */}
          <div className="min-h-[260px] flex flex-col justify-center">
            {stage === 'explain' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center">
                    <div className="text-3xl mb-2">👌</div>
                    <div className="text-sm font-bold text-cyan-300 font-display mb-1">Pinch to Grab</div>
                    <p className="text-xs text-white/60 leading-relaxed">
                      Bring thumb and index finger together in front of the camera (or click and hold mouse).
                    </p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center">
                    <div className="text-3xl mb-2">🖐️</div>
                    <div className="text-sm font-bold text-emerald-300 font-display mb-1">Release to Drop</div>
                    <p className="text-xs text-white/60 leading-relaxed">
                      Open your fingers over the apparatus or beaker to react and pour chemical solutions.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setStage('practice')}
                    className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 px-6 py-2.5 rounded-xl text-white text-xs font-bold font-mono transition-all hover:scale-105 cursor-pointer shadow-lg"
                  >
                    Try Interactive Practice &rarr;
                  </button>
                </div>
              </motion.div>
            )}

            {stage === 'practice' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center">
                <p className="text-xs text-white/70 mb-3 text-center">
                  Drag the flask on the left into the glowing target zone on the right!
                </p>

                {/* 2D Interactive Drag Area (Zero WebGL conflict) */}
                <div
                  onMouseMove={handleDragMove}
                  onTouchMove={handleDragMove}
                  onMouseUp={handleDragEnd}
                  onTouchEnd={handleDragEnd}
                  className="w-full h-44 bg-black/40 rounded-2xl border border-white/15 relative overflow-hidden flex items-center justify-between px-12 cursor-grab active:cursor-grabbing"
                >
                  {/* Drop Target Zone */}
                  <div className={`w-20 h-20 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${draggedToTarget ? 'border-emerald-400 bg-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.5)]' : 'border-cyan-400/60 bg-cyan-500/10'}`}>
                    <span className="text-xs font-mono font-bold text-cyan-200">Drop Here</span>
                  </div>

                  {/* Draggable Flask */}
                  <div
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                    style={{
                      transform: `translate(${flaskPos.x - 60}px, ${flaskPos.y - 120}px) scale(${isDragging ? 1.1 : 1})`,
                      transition: isDragging ? 'none' : 'transform 0.3s ease-out',
                    }}
                    className="absolute w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 border border-purple-300 flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(147,51,234,0.5)] cursor-grab active:cursor-grabbing select-none"
                  >
                    🧪
                  </div>
                </div>

                {draggedToTarget && (
                  <div className="mt-3 text-emerald-400 font-mono text-xs font-bold animate-bounce">
                    ✓ Perfect! Drop registered successfully.
                  </div>
                )}
              </motion.div>
            )}

            {stage === 'confirm' && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4 space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(16,185,129,0.5)]">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-display text-white mb-1">You Are Ready for the Lab!</h3>
                  <p className="text-xs text-white/60 max-w-sm mx-auto">
                    You can now perform experiments using your camera hand tracking or your mouse.
                  </p>
                </div>
                <button
                  onClick={handleFinish}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 px-8 py-3.5 rounded-2xl text-white font-display font-bold shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2 mx-auto"
                >
                  <Sparkles size={18} />
                  <span>Enter Science Lab</span>
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
