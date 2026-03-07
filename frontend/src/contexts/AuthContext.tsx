/// <reference types="vite/client" />

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';

interface ImportMetaEnv {
  readonly VITE_USER_SERVICE_URL: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { setUser: setStoreUser, logout: storeLogout } = useAppStore();

  // Helper to sync any Supabase user → app store
  const syncToStore = (supabaseUser: User | null) => {
    if (supabaseUser) {
      setStoreUser({
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        name:
          supabaseUser.user_metadata?.display_name || supabaseUser.email?.split('@')[0] || 'User',
      });
    } else {
      storeLogout();
    }
  };

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      syncToStore(session?.user ?? null); // ← sync on initial load
      setLoading(false);
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      syncToStore(session?.user ?? null); // ← sync on every auth change
    });

    return () => subscription?.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    });

    if (error) throw error;

    if (data.user) {
      const response = await fetch(`${import.meta.env.VITE_USER_SERVICE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: data.user.id,
          email: data.user.email,
          display_name: name,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create user profile');
      }

      syncToStore(data.user); // ← sync immediately after signup
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    syncToStore(data.user); // ← sync immediately after signin
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    // storeLogout() is handled by onAuthStateChange above
  };

  const value: AuthContextType = {
    user,
    loading,
    signUp,
    signIn,
    signOut,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
