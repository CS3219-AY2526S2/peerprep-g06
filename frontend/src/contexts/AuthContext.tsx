/// <reference types="vite/client" />

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';

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
  const syncToStore = async (supabaseUser: User | null) => {
    if (supabaseUser) {
      const { data } = await supabase
        .from('profiles')
        .select('role, is_requesting_admin')
        .eq('id', supabaseUser.id)
        .single();

      setStoreUser({
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        name:
          supabaseUser.user_metadata?.display_name || supabaseUser.email?.split('@')[0] || 'User',
        role: data?.role ?? 'user',
        isRequestingAdmin: data?.is_requesting_admin ?? false, // ← add this
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
      await syncToStore(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      syncToStore(session?.user ?? null);
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
      // Upsert profile in case trigger hasn't fired yet
      await supabase.from('profiles').upsert([
        {
          id: data.user.id,
          email: data.user.email,
          display_name: name,
        },
      ]);

      await syncToStore(data.user);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await syncToStore(data.user);
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
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
