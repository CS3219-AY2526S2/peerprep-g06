import { create } from 'zustand';
import { SessionReadyPayload } from '../../../shared/types';

export type AppState = 'landing' | 'login' | 'signup' | 'matching' | 'queue' | 'session';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'joining'
  | 'connected'
  | 'live'
  | 'reconnecting'
  | 'rejoined-awaiting-sync'
  | 'reconnect-failed'
  | 'grace-expired'
  | 'disconnected'
  | 'ended'
  | 'error';

const PENDING_SESSION_STORAGE_KEY = 'peerprep.pendingSession';

interface PersistedPendingSession {
  session: SessionReadyPayload;
  savedAt: string;
}

function parsePendingSession(value: string): SessionReadyPayload | null {
  const parsed = JSON.parse(value) as PersistedPendingSession | SessionReadyPayload;

  if (
    parsed &&
    typeof parsed === 'object' &&
    'session' in parsed &&
    parsed.session &&
    typeof parsed.session === 'object'
  ) {
    return parsed.session;
  }

  return parsed as SessionReadyPayload;
}

function loadPendingSession(): SessionReadyPayload | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedValue =
    window.localStorage.getItem(PENDING_SESSION_STORAGE_KEY) ||
    window.sessionStorage.getItem(PENDING_SESSION_STORAGE_KEY);
  if (!storedValue) {
    return null;
  }

  try {
    const session = parsePendingSession(storedValue);

    if (window.sessionStorage.getItem(PENDING_SESSION_STORAGE_KEY)) {
      window.sessionStorage.removeItem(PENDING_SESSION_STORAGE_KEY);
      if (session) {
        persistPendingSession(session);
      }
    }

    return session;
  } catch {
    window.localStorage.removeItem(PENDING_SESSION_STORAGE_KEY);
    window.sessionStorage.removeItem(PENDING_SESSION_STORAGE_KEY);
    return null;
  }
}

function persistPendingSession(session: SessionReadyPayload | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(PENDING_SESSION_STORAGE_KEY);
    window.sessionStorage.removeItem(PENDING_SESSION_STORAGE_KEY);
    return;
  }

  const storedValue: PersistedPendingSession = {
    session,
    savedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(PENDING_SESSION_STORAGE_KEY, JSON.stringify(storedValue));
  window.sessionStorage.removeItem(PENDING_SESSION_STORAGE_KEY);
}

interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'developer';
  isRequestingAdmin: boolean;
  isRequestingDemote: boolean;
}

interface AppStore {
  currentState: AppState;
  user: User | null;
  selectedDifficulty: Difficulty | null;
  selectedTopics: string[];
  selectedLanguage: string | null;
  matchedPeer: User | null;
  sessionCode: string;
  pendingSession: SessionReadyPayload | null;
  collabNotificationStatus: ConnectionStatus;
  collabSessionStatus: ConnectionStatus;
  collabError: string | null;

  setCurrentState: (state: AppState) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
  setDifficulty: (difficulty: Difficulty) => void;
  setTopic: (topic: string[]) => void;
  setLanguage: (language: string) => void;
  setMatchedPeer: (peer: User | null) => void;
  setSessionCode: (code: string) => void;
  setPendingSession: (session: SessionReadyPayload | null) => void;
  clearPendingSession: () => void;
  setCollabNotificationStatus: (status: ConnectionStatus) => void;
  setCollabSessionStatus: (status: ConnectionStatus) => void;
  setCollabError: (error: string | null) => void;
  resetMatching: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  currentState: 'landing',
  user: null,
  selectedDifficulty: null,
  selectedTopics: [],
  selectedLanguage: null,
  matchedPeer: null,
  sessionCode: `function solution(input) {\n  // Write your solution here\n  \n  return result;\n}`,
  pendingSession: loadPendingSession(),
  collabNotificationStatus: 'idle',
  collabSessionStatus: 'idle',
  collabError: null,

  setCurrentState: (state) => set({ currentState: state }),

  setUser: (user) =>
    set({
      user,
      currentState: user ? 'matching' : 'landing',
    }),

  logout: () =>
    (() => {
      persistPendingSession(null);
      set({
        user: null,
        currentState: 'landing',
        selectedDifficulty: null,
        selectedTopics: [],
        selectedLanguage: null,
        matchedPeer: null,
        pendingSession: null,
        collabNotificationStatus: 'idle',
        collabSessionStatus: 'idle',
        collabError: null,
      });
    })(),

  setDifficulty: (difficulty) => set({ selectedDifficulty: difficulty }),
  setTopic: (topic) => set({ selectedTopics: topic }),
  setLanguage: (language) => set({ selectedLanguage: language }),
  setMatchedPeer: (peer) => set({ matchedPeer: peer }),
  setSessionCode: (code) => set({ sessionCode: code }),
  setPendingSession: (session) => {
    persistPendingSession(session);
    set({ pendingSession: session });
  },
  clearPendingSession: () => {
    persistPendingSession(null);
    set({ pendingSession: null });
  },
  setCollabNotificationStatus: (status) => set({ collabNotificationStatus: status }),
  setCollabSessionStatus: (status) => set({ collabSessionStatus: status }),
  setCollabError: (error) => set({ collabError: error }),

  resetMatching: () =>
    (() => {
      persistPendingSession(null);
      set({
        selectedDifficulty: null,
        selectedTopics: [],
        matchedPeer: null,
        currentState: 'matching',
        pendingSession: null,
        collabNotificationStatus: 'idle',
        collabSessionStatus: 'idle',
        collabError: null,
      });
    })(),
}));
