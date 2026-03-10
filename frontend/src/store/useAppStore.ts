import { create } from 'zustand';

export type AppState = 'landing' | 'login' | 'signup' | 'matching' | 'queue' | 'session';
export type Difficulty = 'easy' | 'medium' | 'hard';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'developer';
}

interface AppStore {
  currentState: AppState;
  user: User | null;
  selectedDifficulty: Difficulty | null;
  selectedTopic: string | null;
  selectedLanguage: string | null;
  matchedPeer: User | null;
  sessionCode: string;

  setCurrentState: (state: AppState) => void;
  setUser: (user: User | null) => void; // ← replaces fake login(), driven by AuthContext
  logout: () => void;
  setDifficulty: (difficulty: Difficulty) => void;
  setTopic: (topic: string) => void;
  setLanguage: (language: string) => void;
  setMatchedPeer: (peer: User | null) => void;
  setSessionCode: (code: string) => void;
  resetMatching: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  currentState: 'landing',
  user: null,
  selectedDifficulty: null,
  selectedTopic: null,
  selectedLanguage: null,
  matchedPeer: null,
  sessionCode: `function solution(input) {\n  // Write your solution here\n  \n  return result;\n}`,

  setCurrentState: (state) => set({ currentState: state }),

  // Set real user from Supabase auth (replaces fake login)
  setUser: (user) =>
    set({
      user,
      currentState: user ? 'matching' : 'landing',
    }),

  logout: () =>
    set({
      user: null,
      currentState: 'landing',
      selectedDifficulty: null,
      selectedTopic: null,
      selectedLanguage: null,
      matchedPeer: null,
    }),

  setDifficulty: (difficulty) => set({ selectedDifficulty: difficulty }),
  setTopic: (topic) => set({ selectedTopic: topic }),
  setLanguage: (language) => set({ selectedLanguage: language }),
  setMatchedPeer: (peer) => set({ matchedPeer: peer }),
  setSessionCode: (code) => set({ sessionCode: code }),

  resetMatching: () =>
    set({
      selectedDifficulty: null,
      selectedTopic: null,
      matchedPeer: null,
      currentState: 'matching',
    }),
}));
