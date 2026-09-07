import { useAppStore } from '../store/useAppStore';
import { Button } from '../components/ui/Button';
import { motion } from 'motion/react';

export function Landing() {
  const setView = useAppStore(state => state.setView);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative">
      {/* Top Left Logo & Brand */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="absolute top-6 left-6 md:top-8 md:left-10 flex items-center gap-3.5 z-20 select-none"
      >
        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-1.5 flex items-center justify-center shadow-[0_0_25px_rgba(155,81,248,0.3)] hover:scale-105 transition-all">
          <img
            src="/mindlab_logo.svg"
            alt="MIND LAB AI Logo"
            className="w-full h-full object-contain drop-shadow-md rounded-xl"
          />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-base md:text-lg font-display font-bold text-white tracking-tight leading-tight">
              MIND LAB
            </span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/40">
              AI
            </span>
          </div>
          <span className="text-[10px] font-mono text-cyan-300/80 tracking-widest uppercase">
            Virtual Lab Platform
          </span>
        </div>
      </motion.div>
      
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: 'easeOut' }}
        className="text-center z-10 max-w-4xl"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="mb-6 inline-flex items-center gap-2 glass-panel px-6 py-2 rounded-full border border-cyan-500/30 text-cyan-400 font-mono text-sm tracking-widest uppercase shadow-[0_0_20px_rgba(0,242,255,0.2)]"
        >
          <span>✨</span>
          <span>SIH 2026 • Beta Prototype v1.0</span>
        </motion.div>
        
        <h1 className="text-7xl md:text-9xl font-display font-bold mb-6 tracking-tighter leading-tight uppercase">
          MIND LAB <br/>
          <span className="text-gradient">AI</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-300 font-light mb-16 max-w-2xl mx-auto leading-relaxed">
          Interactive NCERT-based practical learning platform powered by spatial computing and AI. <span className="text-cyan-300 font-normal">Made for SIH 2026.</span>
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <Button 
            variant="accent" 
            className="w-full sm:w-auto text-lg px-10 py-5"
            onClick={() => setView('student-portal')}
          >
            Enter Student Portal
          </Button>
          <Button 
            variant="glass" 
            className="w-full sm:w-auto text-lg px-10 py-5"
            onClick={() => setView('teacher-portal')}
          >
            Teacher Dashboard
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
