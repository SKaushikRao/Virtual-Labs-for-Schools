import { useAppStore } from '../store/useAppStore';
import { Button } from '../components/ui/Button';
import { motion } from 'motion/react';
import { BookOpen, Beaker, Dna, Atom } from 'lucide-react';

export function StudentPortal() {
  const { setView, setClass, setSubject } = useAppStore();

  const handleClassSelect = (cls: string) => {
    setClass(cls);
    // Move to subject selection, but for this prototype we'll directly show subjects on the same page
    // Actually, let's keep it simple. Have them select class then subject.
  };

  const classes = ['Class 9', 'Class 10', 'Class 11', 'Class 12'];
  const subjects = [
    { name: 'Chemistry', icon: Beaker, color: 'text-blue-400', available: true },
    { name: 'Physics', icon: Atom, color: 'text-purple-400', available: false },
    { name: 'Biology', icon: Dna, color: 'text-green-400', available: false },
  ];

  return (
    <div className="min-h-screen p-8 md:p-24">
      
      <Button variant="glass" className="mb-12" onClick={() => setView('landing')}>
        &larr; Back to Home
      </Button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        <h2 className="text-4xl md:text-5xl font-display font-bold mb-12">Select Your <span className="text-gradient">Grade</span></h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
          {classes.map((cls, i) => (
            <motion.button
              key={cls}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => handleClassSelect(cls)}
              className="glass-panel p-8 text-2xl font-display font-bold rounded-2xl hover:bg-white/10 hover:scale-105 transition-all text-center focus:ring-2 focus:ring-cyan-500"
            >
              {cls}
            </motion.button>
          ))}
        </div>

        <h2 className="text-4xl md:text-5xl font-display font-bold mb-12">Select <span className="text-gradient-green">Laboratory</span></h2>
        
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
                  if (sub.available) {
                    setSubject(sub.name);
                    setView('experiment-selection');
                  }
                }}
                disabled={!sub.available}
                className={`glass-panel p-10 rounded-3xl text-left relative overflow-hidden group ${!sub.available ? 'opacity-50 cursor-not-allowed' : 'hover:border-cyan-500/50 hover:bg-white/5 cursor-pointer'}`}
              >
                <div className={`p-4 rounded-2xl bg-black/40 inline-block mb-6 ${sub.color}`}>
                  <Icon size={48} />
                </div>
                <h3 className="text-3xl font-display font-bold mb-2">{sub.name}</h3>
                <p className="text-gray-400 font-light">
                  {sub.available ? 'Enter the interactive 3D lab environment.' : 'Coming soon in v2.0'}
                </p>
                
                {sub.available && (
                  <div className="mt-8 text-cyan-400 flex items-center font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Enter Lab &rarr;
                  </div>
                )}
              </motion.button>
            )
          })}
        </div>
      </motion.div>
    </div>
  );
}
