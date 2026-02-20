import { create } from 'zustand';
import { useAuth } from '@/contexts/AuthContext';

interface AppStoreState {
  userName: string;
  userEmail: string;
  setUserInfo: (email: string, name: string) => void;
  clearUserInfo: () => void;
}

// This is a simple store to manage app-level state
export const useAppStore = create<AppStoreState>((set) => ({
  userName: '',
  userEmail: '',

  setUserInfo: (email: string, name: string) => set({ userEmail: email, userName: name }),

  clearUserInfo: () => set({ userName: '', userEmail: '' }),
}));

// Hook to sync auth with app store
export const useSyncAuthStore = () => {
  const { user } = useAuth();
  const { setUserInfo, clearUserInfo } = useAppStore();

  if (user) {
    const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'User';
    setUserInfo(user.email || '', displayName);
  } else {
    clearUserInfo();
  }
};
