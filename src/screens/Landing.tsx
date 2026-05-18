import { useAppStore } from '../store/useAppStore';
import { Button } from '../components/ui/Button';
import { motion } from 'motion/react';

export function Landing() {
  const setView = useAppStore(state => state.setView);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative">
      
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
          className="mb-6 inline-block glass-panel px-6 py-2 rounded-full border border-cyan-500/30 text-cyan-400 font-mono text-sm tracking-widest uppercase"
        >
          Beta Prototype v1.0
        </motion.div>
        
        <h1 className="text-7xl md:text-9xl font-display font-bold mb-6 tracking-tighter leading-tight">
          Virtual <br/>
          <span className="text-gradient">Science Lab</span>
        </h1>
        
        <p className="text-xl md:text-3xl text-gray-400 font-light mb-16 max-w-2xl mx-auto">
          Interactive NCERT-based practical learning platform powered by spatial computing and AI.
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
