import React, { Suspense, lazy } from 'react';
import { useAppStore } from './store/useAppStore';
import { Landing } from './screens/Landing';
import { StudentPortal } from './screens/StudentPortal';
import { TeacherPortal } from './screens/TeacherPortal';
import { ExperimentSelection } from './screens/ExperimentSelection';

// Code-split / lazy-load experiment scenes for optimal bundle performance
const ChemistryLab = lazy(() =>
  import('./screens/ChemistryLab').then((m) => ({ default: m.ChemistryLab }))
);
const FlameTestLab = lazy(() =>
  import('./screens/FlameTestLab').then((m) => ({ default: m.FlameTestLab }))
);
const CrystallizationLab = lazy(() =>
  import('./screens/CrystallizationLab').then((m) => ({ default: m.CrystallizationLab }))
);
const PHTestingLab = lazy(() =>
  import('./screens/PHTestingLab').then((m) => ({ default: m.PHTestingLab }))
);

const OhmsLawLab = lazy(() =>
  import('./screens/OhmsLawLab').then((m) => ({ default: m.OhmsLawLab }))
);
const SimplePendulumLab = lazy(() =>
  import('./screens/SimplePendulumLab').then((m) => ({ default: m.SimplePendulumLab }))
);
const RefractionLab = lazy(() =>
  import('./screens/RefractionLab').then((m) => ({ default: m.RefractionLab }))
);

const OnionPeelLab = lazy(() =>
  import('./screens/OnionPeelLab').then((m) => ({ default: m.OnionPeelLab }))
);
const StomataLab = lazy(() =>
  import('./screens/StomataLab').then((m) => ({ default: m.StomataLab }))
);
const HumanHeartLab = lazy(() =>
  import('./screens/HumanHeartLab').then((m) => ({ default: m.HumanHeartLab }))
);

function LabRouter() {
  const selectedExperiment = useAppStore((state) => state.selectedExperiment);

  switch (selectedExperiment) {
    // Chemistry
    case 'titration-10':
      return <ChemistryLab />;
    case 'flame-test':
      return <FlameTestLab />;
    case 'crystallization':
      return <CrystallizationLab />;
    case 'ph-testing':
      return <PHTestingLab />;

    // Physics
    case 'ohms-law':
      return <OhmsLawLab />;
    case 'simple-pendulum':
      return <SimplePendulumLab />;
    case 'refraction-slab':
      return <RefractionLab />;

    // Biology
    case 'onion-peel':
      return <OnionPeelLab />;
    case 'stomata-obs':
      return <StomataLab />;
    case 'human-heart':
      return <HumanHeartLab />;

    default:
      return <ChemistryLab />;
  }
}

export default function App() {
  const currentView = useAppStore((state) => state.currentView);

  return (
    <div className="w-full min-h-screen text-white bg-[#05060f] relative overflow-hidden font-sans">
      <div className="atmosphere-bg">
        <div className="atmosphere-glow" />
      </div>

      <Suspense
        fallback={
          <div className="w-full h-screen flex flex-col items-center justify-center bg-[#05060f] gap-4">
            <div className="w-12 h-12 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(0,242,255,0.4)]" />
            <span className="text-xs font-mono text-cyan-300 uppercase tracking-widest animate-pulse">
              Initializing 3D Lab Simulation...
            </span>
          </div>
        }
      >
        {currentView === 'landing' && <Landing />}
        {currentView === 'student-portal' && <StudentPortal />}
        {currentView === 'experiment-selection' && <ExperimentSelection />}
        {currentView === 'teacher-portal' && <TeacherPortal />}
        {currentView === 'experiment' && <LabRouter />}
      </Suspense>
    </div>
  );
}
