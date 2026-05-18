import { useAppStore } from '../store/useAppStore';
import { Button } from '../components/ui/Button';
import { motion } from 'motion/react';

type Experiment = {
  id: string;
  title: string;
  desc: string;
  difficulty: string;
  time: string;
  cbseFrequency: string;
};

const experimentsByClass: Record<string, Experiment[]> = {
  'Class 5': [
    { id: 'soluble-insoluble', title: 'Soluble and Insoluble Substances', desc: 'Understanding which materials dissolve in water.', difficulty: 'Beginner', time: '10 min', cbseFrequency: 'Asked in 60% of exams' },
    { id: 'floating-sinking', title: 'Floating and Sinking', desc: 'Categorize objects based on floating or sinking in water.', difficulty: 'Beginner', time: '10 min', cbseFrequency: 'Asked in 55% of exams' }
  ],
  'Class 6': [
    { id: 'filtration', title: 'Separation by Filtration', desc: 'Separate sand-water mixture using filter paper and funnel.', difficulty: 'Beginner', time: '15 min', cbseFrequency: 'Asked in 75% of exams' },
    { id: 'evaporation', title: 'Evaporation of Salt Solution', desc: 'Recover salt from a solution by heating and evaporation.', difficulty: 'Beginner', time: '15 min', cbseFrequency: 'Asked in 65% of exams' }
  ],
  'Class 7': [
    { id: 'litmus-test', title: 'Acid & Base Litmus Test', desc: 'Identify acids and bases using red and blue litmus paper.', difficulty: 'Beginner', time: '10 min', cbseFrequency: 'Asked in 80% of exams' },
    { id: 'physical-chemical', title: 'Physical & Chemical Changes', desc: 'React iron nail with copper sulphate solution.', difficulty: 'Intermediate', time: '20 min', cbseFrequency: 'Asked in 70% of exams' }
  ],
  'Class 8': [
    { id: 'crystallization', title: 'Crystallization of Copper Sulphate', desc: 'Form blue crystals from a saturated copper sulphate solution.', difficulty: 'Intermediate', time: '25 min', cbseFrequency: 'Asked in 60% of exams' },
    { id: 'combustion', title: 'Combustion Experiment', desc: 'Observe flame going out due to lack of oxygen in a glass jar.', difficulty: 'Beginner', time: '10 min', cbseFrequency: 'Asked in 85% of exams' }
  ],
  'Class 9': [
    { id: 'separation-mixtures', title: 'Separation of Mixtures', desc: 'Separate ammonium chloride, salt, and sand using sublimation.', difficulty: 'Intermediate', time: '20 min', cbseFrequency: 'Asked in 75% of exams' },
    { id: 'melting-point', title: 'Determination of Melting Point', desc: 'Record temperature changes while melting ice.', difficulty: 'Beginner', time: '15 min', cbseFrequency: 'Asked in 50% of exams' },
    { id: 'conservation-mass', title: 'Law of Conservation of Mass', desc: 'Measure mass before and after reacting sodium sulphate and barium chloride.', difficulty: 'Intermediate', time: '15 min', cbseFrequency: 'Asked in 85% of exams' }
  ],
  'Class 10': [
    { id: 'ph-testing', title: 'pH Testing (Universal Indicator)', desc: 'Test lemon juice, soap, and water using universal indicator.', difficulty: 'Beginner', time: '15 min', cbseFrequency: 'Asked in 90% of exams' },
    { id: 'titration-10', title: 'Acid-Base Neutralization', desc: 'Perform titration of HCl and NaOH using phenolphthalein.', difficulty: 'Intermediate', time: '20 min', cbseFrequency: 'Asked in 85% of exams' },
    { id: 'acid-base-props', title: 'Properties of Acids and Bases', desc: 'React zinc with dilute acid and test for hydrogen gas.', difficulty: 'Intermediate', time: '20 min', cbseFrequency: 'Asked in 70% of exams' }
  ],
  'Class 11': [
    { id: 'standard-solution', title: 'Preparation of Standard Solution', desc: 'Weigh oxalic acid and prepare a standard volumetric solution.', difficulty: 'Intermediate', time: '20 min', cbseFrequency: 'Asked in 65% of exams' },
    { id: 'titration-11', title: 'Titration: Oxalic Acid vs KMnO4', desc: 'Perform redox titration to a permanent light pink endpoint.', difficulty: 'Advanced', time: '25 min', cbseFrequency: 'Asked in 95% of exams' },
    { id: 'chromatography', title: 'Paper Chromatography', desc: 'Separate ink pigments using a solvent and chromatography paper.', difficulty: 'Intermediate', time: '15 min', cbseFrequency: 'Asked in 70% of exams' },
    { id: 'colloidal', title: 'Preparation of Colloidal Solution', desc: 'Mix chemicals to form and observe a colloidal solution.', difficulty: 'Intermediate', time: '15 min', cbseFrequency: 'Asked in 50% of exams' }
  ],
  'Class 12': [
    { id: 'electro-cell', title: 'Electrochemical Cell', desc: 'Set up zinc and copper half-cells with a salt bridge.', difficulty: 'Advanced', time: '25 min', cbseFrequency: 'Asked in 80% of exams' },
    { id: 'rate-reaction', title: 'Rate of Reaction', desc: 'Mix sodium thiosulphate and HCl, and measure precipitation time.', difficulty: 'Intermediate', time: '20 min', cbseFrequency: 'Asked in 75% of exams' },
    { id: 'soap-prep', title: 'Preparation of Soap', desc: 'Saponification: Heat oil, add NaOH, and collect formed soap.', difficulty: 'Advanced', time: '25 min', cbseFrequency: 'Asked in 60% of exams' },
    { id: 'functional-groups', title: 'Tests for Functional Groups', desc: 'Identify alcohol and aldehyde groups using specific reagents.', difficulty: 'Advanced', time: '20 min', cbseFrequency: 'Asked in 90% of exams' }
  ]
};

export function ExperimentSelection() {
  const { setView, setExperiment, selectedClass } = useAppStore();

  const currentClass = selectedClass || 'Class 10';
  const experiments = experimentsByClass[currentClass] || experimentsByClass['Class 10'];

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
            <div className="text-cyan-400 font-mono text-sm uppercase tracking-widest mb-2 shadow-cyan-500/50 drop-shadow-md">{currentClass} Practical Syllabus</div>
            <h2 className="text-4xl md:text-6xl font-display font-bold mb-2">Chemistry <span className="text-gradient">Lab</span></h2>
            <p className="text-xl text-gray-400">Select an experiment to begin.</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {experiments.map((exp, i) => (
            <motion.div
              key={exp.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-panel p-8 rounded-3xl flex flex-col h-full hover:bg-white/[0.08] transition-colors relative group overflow-hidden"
            >
              {/* CBSE Badge */}
              <div className="absolute top-0 right-0 bg-[#4e44ff]/20 text-[#00f2ff] text-[10px] font-mono px-3 py-1 rounded-bl-xl border-b border-l border-[#4e44ff]/30 backdrop-blur-md z-10 group-hover:bg-[#4e44ff]/40 transition-colors">
                {exp.cbseFrequency}
              </div>

              <div className="flex justify-between items-start mb-6">
                <span className={`px-3 py-1 rounded-full text-xs font-mono font-medium ${
                  exp.difficulty === 'Beginner' ? 'bg-green-500/20 text-green-400' : 
                  exp.difficulty === 'Intermediate' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {exp.difficulty}
                </span>
                <span className="text-gray-400 text-sm font-mono">{exp.time}</span>
              </div>
              
              <h3 className="text-2xl font-display font-bold mb-4">{exp.title}</h3>
              <p className="text-gray-400 mb-8 flex-grow">{exp.desc}</p>
              
              <Button 
                variant="accent" 
                className="w-full"
                onClick={() => {
                  setExperiment(exp.id);
                  setView('experiment');
                }}
              >
                Start Experiment
              </Button>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
