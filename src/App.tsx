import { useAppStore } from './store/useAppStore';
import { Landing } from './screens/Landing';
import { StudentPortal } from './screens/StudentPortal';
import { TeacherPortal } from './screens/TeacherPortal';
import { ExperimentSelection } from './screens/ExperimentSelection';
import { ChemistryLab } from './screens/ChemistryLab';

export default function App() {
  const currentView = useAppStore(state => state.currentView);

  return (
    <div className="w-full min-h-screen text-white bg-[#05060f] relative overflow-hidden">
      <div className="atmosphere-bg">
        <div className="atmosphere-glow"></div>
      </div>
      {currentView === 'landing' && <Landing />}
      {currentView === 'student-portal' && <StudentPortal />}
      {currentView === 'experiment-selection' && <ExperimentSelection />}
      {currentView === 'teacher-portal' && <TeacherPortal />}
      {currentView === 'experiment' && <ChemistryLab />}
    </div>
  );
}
