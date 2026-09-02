import { useAppStore } from '../store/useAppStore';
import { Button } from '../components/ui/Button';
import { motion } from 'motion/react';
import { Beaker, Dna, Atom } from 'lucide-react';

export function StudentPortal() {
  const { setView, setClass, setSubject, selectedClass } = useAppStore();

  const handleClassSelect = (cls: string) => {
    setClass(cls);
  };

  const classes = ['Class 9', 'Class 10', 'Class 11', 'Class 12'];
  const subjects = [
    { 
      name: 'Chemistry', 
      icon: Beaker, 
      color: 'text-[#c084fc]', 
      border: 'hover:border-[#4e44ff]/50',
      badge: 'border-[#4e44ff]/40 text-[#c084fc] bg-[#4e44ff]/20',
      desc: 'Acid-base reactions, flame spectrometry, crystallization & pH testing.',
      available: true 
    },
    { 
      name: 'Physics', 
      icon: Atom, 
      color: 'text-cyan-400', 
      border: 'hover:border-cyan-500/50',
      badge: 'border-cyan-500/40 text-cyan-300 bg-cyan-500/20',
      desc: "Ohm's law circuits, simple pendulum mechanics & glass slab refraction.",
      available: true 
    },
    { 
      name: 'Biology', 
      icon: Dna, 
      color: 'text-emerald-400', 
      border: 'hover:border-emerald-500/50',
      badge: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/20',
      desc: 'Onion peel microscopy, leaf stomata & 3D cardiovascular anatomy.',
      available: true 
    },
  ];

  return (
    <div className="min-h-screen p-8 md:p-24 relative">
      <Button variant="glass" className="mb-12" onClick={() => setView('landing')}>
        &larr; Back to Home
      </Button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        <h2 className="text-4xl md:text-5xl font-display font-bold mb-12">
          Select Your <span className="text-gradient">Grade</span>
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
          {classes.map((cls, i) => {
            const isSelected = (selectedClass || 'Class 10') === cls;
            return (
              <motion.button
                key={cls}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => handleClassSelect(cls)}
                className={`glass-panel p-8 text-2xl font-display font-bold rounded-2xl hover:scale-105 transition-all text-center cursor-pointer ${
                  isSelected ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_20px_rgba(0,242,255,0.3)]' : 'hover:bg-white/10'
                }`}
              >
                {cls}
              </motion.button>
            );
          })}
        </div>

        <h2 className="text-4xl md:text-5xl font-display font-bold mb-12">
          Select <span className="text-gradient-green">Laboratory</span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {subjects.map((sub, i) => {
            const Icon = sub.icon;
            return (
              <motion.button
                key={sub.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 + 0.3 }}
                onClick={() => {
                  setSubject(sub.name);
                  setView('experiment-selection');
                }}
                className={`glass-panel p-10 rounded-3xl text-left relative overflow-hidden group hover:bg-white/5 cursor-pointer ${sub.border}`}
              >
                <div className={`p-4 rounded-2xl bg-black/40 inline-block mb-6 ${sub.color}`}>
                  <Icon size={48} />
                </div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-3xl font-display font-bold text-white">{sub.name}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${sub.badge}`}>
                    Ready
                  </span>
                </div>
                <p className="text-gray-400 font-light text-sm mb-6">
                  {sub.desc}
                </p>
                
                <div className="mt-4 text-cyan-400 flex items-center font-medium opacity-80 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                  Enter Subject Lab &rarr;
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
