import { useAppStore } from '../store/useAppStore';
import { Button } from '../components/ui/Button';
import { motion } from 'motion/react';

type Experiment = {
  id: string;
  subject: 'Chemistry' | 'Physics' | 'Biology';
  title: string;
  desc: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  time: string;
  cbseFrequency: string;
};

const EXPERIMENTS_DATABASE: Record<string, Experiment[]> = {
  Chemistry: [
    {
      id: 'titration-10',
      subject: 'Chemistry',
      title: 'Acid-Base Neutralization Titration',
      desc: 'Perform quantitative neutralization of NaOH using HCl with phenolphthalein indicator.',
      difficulty: 'Intermediate',
      time: '20 min',
      cbseFrequency: 'Asked in 90% of Board Exams',
    },
    {
      id: 'flame-test',
      subject: 'Chemistry',
      title: 'Flame Test for Metal Ions',
      desc: 'Identify metal cations (Sodium, Copper, Potassium) through distinct flame emission spectra.',
      difficulty: 'Beginner',
      time: '15 min',
      cbseFrequency: 'Asked in 85% of Board Exams',
    },
    {
      id: 'crystallization',
      subject: 'Chemistry',
      title: 'Preparation of Pure CuSO4 Crystals',
      desc: 'Simulate heating solution to saturation and undisturbed cooling for crystal precipitation.',
      difficulty: 'Intermediate',
      time: '25 min',
      cbseFrequency: 'Asked in 75% of Board Exams',
    },
    {
      id: 'ph-testing',
      subject: 'Chemistry',
      title: 'pH Testing with Universal Indicator',
      desc: 'Assay acids, neutral water, and bases across full rainbow pH color spectrum.',
      difficulty: 'Beginner',
      time: '15 min',
      cbseFrequency: 'Asked in 80% of Board Exams',
    },
  ],
  Physics: [
    {
      id: 'ohms-law',
      subject: 'Physics',
      title: "Verification of Ohm's Law (V = IR)",
      desc: 'Assemble breadboard circuit, adjust rheostat, and record current vs voltage linearity.',
      difficulty: 'Intermediate',
      time: '20 min',
      cbseFrequency: 'Asked in 95% of Board Exams',
    },
    {
      id: 'simple-pendulum',
      subject: 'Physics',
      title: 'Simple Pendulum (Period vs Length)',
      desc: 'Measure harmonic oscillation period for multiple string lengths and verify T ∝ √L.',
      difficulty: 'Beginner',
      time: '15 min',
      cbseFrequency: 'Asked in 85% of Board Exams',
    },
    {
      id: 'refraction-slab',
      subject: 'Physics',
      title: 'Refraction Through Glass Slab',
      desc: "Measure incident and refracted ray angles, verify Snell's Law, and calculate lateral shift.",
      difficulty: 'Intermediate',
      time: '20 min',
      cbseFrequency: 'Asked in 90% of Board Exams',
    },
  ],
  Biology: [
    {
      id: 'onion-peel',
      subject: 'Biology',
      title: 'Onion Peel Cell Observation',
      desc: 'Mount epidermal peel stained with Safranin under virtual compound microscope (400x).',
      difficulty: 'Beginner',
      time: '15 min',
      cbseFrequency: 'Asked in 90% of Board Exams',
    },
    {
      id: 'stomata-obs',
      subject: 'Biology',
      title: 'Stomata & Guard Cells Observation',
      desc: 'Examine leaf epidermal peel to observe stomatal pore turgor opening and closing.',
      difficulty: 'Intermediate',
      time: '15 min',
      cbseFrequency: 'Asked in 85% of Board Exams',
    },
    {
      id: 'human-heart',
      subject: 'Biology',
      title: '3D Human Heart & Blood Circulation',
      desc: 'Interactive 3D cardiovascular anatomy: inspect all 4 chambers and systemic blood pathways.',
      difficulty: 'Beginner',
      time: '20 min',
      cbseFrequency: 'Asked in 80% of Board Exams',
    },
  ],
};

export function ExperimentSelection() {
  const { setView, setExperiment, selectedClass, selectedSubject } = useAppStore();

  const currentClass = selectedClass || 'Class 10';
  const currentSubject = selectedSubject || 'Chemistry';
  const experiments = EXPERIMENTS_DATABASE[currentSubject] || EXPERIMENTS_DATABASE.Chemistry;

  const themeColors = {
    Chemistry: {
      text: 'text-[#c084fc]',
      badge: 'border-[#4e44ff]/40 text-[#c084fc] bg-[#4e44ff]/20',
      btn: 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500',
    },
    Physics: {
      text: 'text-cyan-400',
      badge: 'border-cyan-500/40 text-cyan-300 bg-cyan-500/20',
      btn: 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500',
    },
    Biology: {
      text: 'text-emerald-400',
      badge: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/20',
      btn: 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500',
    },
  }[currentSubject as 'Chemistry' | 'Physics' | 'Biology'] || {
    text: 'text-cyan-400',
    badge: 'border-cyan-500/40 text-cyan-300 bg-cyan-500/20',
    btn: 'bg-gradient-to-r from-cyan-500 to-blue-600',
  };

  return (
    <div className="min-h-screen p-8 md:p-24 relative overflow-hidden">
      <Button variant="glass" className="mb-12 relative z-10" onClick={() => setView('student-portal')}>
        &larr; Back to Subjects
      </Button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto relative z-10"
      >
        <div className="flex items-end justify-between mb-12">
          <div>
            <div className={`font-mono text-xs uppercase tracking-widest mb-2 px-3 py-1 rounded-full border inline-block ${themeColors.badge}`}>
              {currentClass} • {currentSubject} Practical Syllabus
            </div>
            <h2 className="text-4xl md:text-6xl font-display font-bold mb-2">
              {currentSubject} <span className={themeColors.text}>Laboratory</span>
            </h2>
            <p className="text-lg text-gray-400">Select an interactive 3D experiment to launch.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {experiments.map((exp, i) => (
            <motion.div
              key={exp.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-panel p-8 rounded-3xl flex flex-col h-full hover:bg-white/[0.08] transition-all relative group overflow-hidden border border-white/10 hover:border-white/25"
            >
              {/* CBSE Board Exam Frequency Badge */}
              <div className="absolute top-0 right-0 bg-white/5 text-cyan-300 text-[10px] font-mono px-3 py-1 rounded-bl-xl border-b border-l border-white/10 backdrop-blur-md z-10">
                {exp.cbseFrequency}
              </div>

              <div className="flex justify-between items-start mb-6">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-mono font-medium ${
                    exp.difficulty === 'Beginner'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : exp.difficulty === 'Intermediate'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {exp.difficulty}
                </span>
                <span className="text-gray-400 text-xs font-mono">{exp.time}</span>
              </div>

              <h3 className="text-2xl font-display font-bold mb-3 text-white group-hover:text-cyan-200 transition-colors">
                {exp.title}
              </h3>
              <p className="text-gray-400 text-xs leading-relaxed mb-8 flex-grow">
                {exp.desc}
              </p>

              <button
                onClick={() => {
                  setExperiment(exp.id);
                  setView('experiment');
                }}
                className={`w-full py-3.5 rounded-2xl text-white font-display font-bold text-sm transition-all hover:scale-105 active:scale-95 shadow-lg cursor-pointer ${themeColors.btn}`}
              >
                Launch Experiment
              </button>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
