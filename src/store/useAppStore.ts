import { create } from 'zustand';

type ViewState = 'landing' | 'student-portal' | 'teacher-portal' | 'experiment-selection' | 'experiment';

interface AppState {
  currentView: ViewState;
  selectedClass: string | null;
  selectedSubject: string | null;
  selectedExperiment: string | null;
  score: number;
  setView: (view: ViewState) => void;
  setClass: (cls: string) => void;
  setSubject: (sub: string) => void;
  setExperiment: (exp: string) => void;
  addScore: (points: number) => void;
  resetScore: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'landing',
  selectedClass: null,
  selectedSubject: null,
  selectedExperiment: null,
  score: 0,
  setView: (view) => set({ currentView: view }),
  setClass: (cls) => set({ selectedClass: cls }),
  setSubject: (sub) => set({ selectedSubject: sub }),
  setExperiment: (exp) => set({ selectedExperiment: exp }),
  addScore: (points) => set((state) => ({ score: Math.max(0, state.score + points) })),
  resetScore: () => set({ score: 0 }),
}));
