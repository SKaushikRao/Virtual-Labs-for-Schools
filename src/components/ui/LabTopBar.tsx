import React from 'react';
import { useAppStore, Language } from '../../store/useAppStore';
import { Sparkles, HelpCircle, ArrowLeft, Globe, ShieldCheck } from 'lucide-react';
import { cn } from '../../utils/cn';

interface LabTopBarProps {
  title: string;
  subject: 'Chemistry' | 'Physics' | 'Biology';
  currentStep: number;
  totalSteps: number;
  isReady?: boolean;
}

export const LabTopBar: React.FC<LabTopBarProps> = ({
  title,
  subject,
  currentStep,
  totalSteps,
  isReady = false,
}) => {
  const setView = useAppStore((s) => s.setView);
  const score = useAppStore((s) => s.score);
  const setTutorialOpen = useAppStore((s) => s.setTutorialOpen);
  const selectedLanguage = useAppStore((s) => s.selectedLanguage);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const isMentorOpen = useAppStore((s) => s.isMentorOpen);
  const toggleMentor = useAppStore((s) => s.toggleMentor);

  const subjectTheme = {
    Chemistry: {
      badgeBg: 'bg-[#4e44ff]/20 text-[#c084fc] border-[#4e44ff]/40',
      activeBorder: 'border-[#4e44ff]',
      glow: 'shadow-[0_0_15px_rgba(78,68,255,0.4)]',
    },
    Physics: {
      badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      activeBorder: 'border-cyan-400',
      glow: 'shadow-[0_0_15px_rgba(0,242,255,0.4)]',
    },
    Biology: {
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      activeBorder: 'border-emerald-400',
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.4)]',
    },
  }[subject];

  return (
    <nav className="h-16 flex items-center justify-between px-6 md:px-8 bg-[#05060f]/80 backdrop-blur-xl border-b border-white/10 z-30 shrink-0 select-none">
      {/* Left: Back button & Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setView('experiment-selection')}
          className="w-9 h-9 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center border border-white/10 text-white hover:text-cyan-300 transition-all hover:scale-105 active:scale-95"
          title="Back to Experiments"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex items-center gap-3">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider border ${subjectTheme.badgeBg}`}>
            {subject}
          </span>
          <h1 className="text-base md:text-lg font-display font-bold tracking-tight text-white/95">
            {title}
          </h1>
        </div>
      </div>

      {/* Center: Step Progress */}
      <div className="hidden md:flex items-center gap-3 bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
        <span className="text-xs uppercase font-mono tracking-widest text-white/50">Progress:</span>
        <span className="text-xs font-mono font-bold text-cyan-300">
          Step {Math.min(currentStep, totalSteps)} of {totalSteps}
        </span>
        <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500"
            style={{ width: `${Math.min(100, (currentStep / totalSteps) * 100)}%` }}
          />
        </div>
      </div>

      {/* Right: Actions, Tutorial, Language, Score, Mentor */}
      <div className="flex items-center gap-3">
        {/* Language Picker */}
        <div className="flex items-center bg-white/5 rounded-xl border border-white/10 p-0.5">
          <button
            onClick={() => setLanguage('en')}
            className={cn(
              "px-2 py-1 text-xs font-mono rounded-lg transition-all",
              selectedLanguage === 'en' ? "bg-white/20 text-cyan-300 font-bold" : "text-white/60 hover:text-white"
            )}
          >
            EN
          </button>
          <button
            onClick={() => setLanguage('hi')}
            className={cn(
              "px-2 py-1 text-xs font-mono rounded-lg transition-all",
              selectedLanguage === 'hi' ? "bg-white/20 text-cyan-300 font-bold" : "text-white/60 hover:text-white"
            )}
          >
            HI
          </button>
          <button
            onClick={() => setLanguage('te')}
            className={cn(
              "px-2 py-1 text-xs font-mono rounded-lg transition-all",
              selectedLanguage === 'te' ? "bg-white/20 text-cyan-300 font-bold" : "text-white/60 hover:text-white"
            )}
          >
            TE
          </button>
        </div>

        {/* Camera Tracking Status */}
        <div className="hidden lg:flex items-center gap-2 bg-white/5 px-3 py-1 rounded-xl border border-white/10">
          <div className={cn("w-2 h-2 rounded-full", isReady ? "bg-emerald-400 animate-pulse" : "bg-amber-400")} />
          <span className="text-[10px] uppercase font-mono font-semibold tracking-wider text-white/70">
            {isReady ? 'Vision Active' : 'Mouse Mode'}
          </span>
        </div>

        {/* Gesture Tutorial Button */}
        <button
          onClick={() => setTutorialOpen(true)}
          className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-xs font-mono text-cyan-300 hover:border-cyan-500/40 transition-all hover:scale-105"
        >
          <HelpCircle size={15} />
          <span className="hidden sm:inline">How to Use</span>
        </button>

        {/* Score Badge */}
        <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 font-mono">
          <span className="text-[10px] uppercase text-white/50">Score</span>
          <span className="text-xs font-bold text-amber-300">{score}</span>
        </div>

        {/* AI Mentor Toggle Button */}
        <button
          onClick={toggleMentor}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all hover:scale-105 border",
            isMentorOpen
              ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-400 shadow-[0_0_15px_rgba(147,51,234,0.5)]"
              : "bg-white/5 text-purple-300 border-white/10 hover:bg-white/10 hover:border-purple-500/40"
          )}
        >
          <Sparkles size={14} className="animate-spin-slow" />
          <span>AI Mentor</span>
        </button>
      </div>
    </nav>
  );
};
