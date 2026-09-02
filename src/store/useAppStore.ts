import { create } from 'zustand';

export type ViewState = 'landing' | 'student-portal' | 'teacher-portal' | 'experiment-selection' | 'experiment';
export type Language = 'en' | 'hi';

interface AppState {
  currentView: ViewState;
  selectedClass: string | null;
  selectedSubject: string | null;
  selectedExperiment: string | null;
  score: number;
  
  // Tutorial State
  hasTutorialCompleted: boolean;
  isTutorialOpen: boolean;
  
  // Mentor & Voice State
  selectedLanguage: Language;
  recentMistake: string | null;
  isMentorOpen: boolean;
  currentStep: number;
  totalSteps: number;

  // Actions
  setView: (view: ViewState) => void;
  setClass: (cls: string) => void;
  setSubject: (sub: string) => void;
  setExperiment: (exp: string) => void;
  addScore: (points: number) => void;
  resetScore: () => void;
  setTutorialOpen: (open: boolean) => void;
  setTutorialCompleted: (completed: boolean) => void;
  setLanguage: (lang: Language) => void;
  setRecentMistake: (mistake: string | null) => void;
  setMentorOpen: (open: boolean) => void;
  toggleMentor: () => void;
  setCurrentStep: (step: number) => void;
  setTotalSteps: (total: number) => void;
}

const getInitialTutorialState = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('vlab_tutorial_completed') === 'true';
};

export const useAppStore = create<AppState>((set) => ({
  currentView: 'landing',
  selectedClass: 'Class 10',
  selectedSubject: 'Chemistry',
  selectedExperiment: 'titration-10',
  score: 0,

  hasTutorialCompleted: getInitialTutorialState(),
  isTutorialOpen: false,

  selectedLanguage: 'en',
  recentMistake: null,
  isMentorOpen: false,
  currentStep: 1,
  totalSteps: 5,

  setView: (view) => set({ currentView: view }),
  setClass: (cls) => set({ selectedClass: cls }),
  setSubject: (sub) => set({ selectedSubject: sub }),
  setExperiment: (exp) => set({ selectedExperiment: exp, currentStep: 1 }),
  addScore: (points) => set((state) => ({ score: Math.max(0, state.score + points) })),
  resetScore: () => set({ score: 0 }),
  
  setTutorialOpen: (open) => set({ isTutorialOpen: open }),
  setTutorialCompleted: (completed) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vlab_tutorial_completed', completed ? 'true' : 'false');
    }
    set({ hasTutorialCompleted: completed, isTutorialOpen: false });
  },
  
  setLanguage: (lang) => set({ selectedLanguage: lang }),
  setRecentMistake: (mistake) => set({ recentMistake: mistake }),
  setMentorOpen: (open) => set({ isMentorOpen: open }),
  toggleMentor: () => set((state) => ({ isMentorOpen: !state.isMentorOpen })),
  setCurrentStep: (step) => set({ currentStep: step }),
  setTotalSteps: (total) => set({ totalSteps: total }),
}));
