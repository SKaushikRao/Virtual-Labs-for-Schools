import { useAppStore } from '../store/useAppStore';
import { Button } from '../components/ui/Button';
import { motion } from 'motion/react';

export function TeacherPortal() {
  const setView = useAppStore(state => state.setView);

  const students = [
    { name: 'Aditi Sharma', class: 'Class 10', exp: 'Acid Base Reaction', score: 95, status: 'Completed' },
    { name: 'Rahul Verma', class: 'Class 10', exp: 'Titration', score: 70, status: 'In Progress' },
    { name: 'Priya Patel', class: 'Class 9', exp: 'Filtration', score: 85, status: 'Completed' },
    { name: 'Rohan Singh', class: 'Class 11', exp: 'Acid Base Reaction', score: 0, status: 'Assigned' },
  ];

  return (
    <div className="min-h-screen p-8 md:p-12 relative">
      
      <div className="flex items-center justify-between mb-12">
        <h2 className="text-3xl font-display font-bold text-gradient">Teacher Dashboard</h2>
        <Button variant="glass" onClick={() => setView('landing')}>Exit Portal</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <StatsCard title="Total Students" value="124" />
        <StatsCard title="Active Experiments" value="45" />
        <StatsCard title="Avg Score" value="82%" />
        <StatsCard title="Completed" value="89" />
      </div>

      <div className="glass-panel rounded-3xl overflow-hidden mt-8">
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <h3 className="text-xl font-display font-bold">Recent Student Activity</h3>
          <Button variant="glass" className="text-sm py-2">Assign New</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-gray-400 font-mono bg-white/5">
                <th className="p-4 pl-6">Student Name</th>
                <th className="p-4">Grade</th>
                <th className="p-4">Experiment</th>
                <th className="p-4">Status</th>
                <th className="p-4 pr-6">Score</th>
              </tr>
            </thead>
            <tbody>
              {students.map((st, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4 pl-6 font-medium">{st.name}</td>
                  <td className="p-4 text-gray-400">{st.class}</td>
                  <td className="p-4">{st.exp}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-mono ${
                      st.status === 'Completed' ? 'bg-green-500/20 text-green-400' :
                      st.status === 'In Progress' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {st.status}
                    </span>
                  </td>
                  <td className="p-4 pr-6 font-mono text-cyan-400">{st.score > 0 ? `${st.score}/100` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatsCard({ title, value }: { title: string, value: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-panel p-6 rounded-2xl"
    >
      <p className="text-sm font-mono text-gray-400 uppercase tracking-widest mb-2">{title}</p>
      <p className="text-4xl font-display font-bold">{value}</p>
    </motion.div>
  );
}
