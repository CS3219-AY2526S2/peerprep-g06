/// <reference types="vite/client" />

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { RealtimeChannel, User } from '@supabase/supabase-js';
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
  const profileChannelRef = useRef<RealtimeChannel | null>(null);

  // Helper to sync any Supabase user → app store
  const syncToStore = async (supabaseUser: User | null) => {
    if (supabaseUser) {
      const { data } = await supabase
        .from('profiles')
        .select('role, is_requesting_admin, is_requesting_demote')
        .eq('id', supabaseUser.id)
        .single();

      setStoreUser({
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        name:
          supabaseUser.user_metadata?.display_name || supabaseUser.email?.split('@')[0] || 'User',
        role: data?.role ?? 'user',
        isRequestingAdmin: data?.is_requesting_admin ?? false,
        isRequestingDemote: data?.is_requesting_demote ?? false, // ← add this
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

  useEffect(() => {
    if (profileChannelRef.current) {
      supabase.removeChannel(profileChannelRef.current);
      profileChannelRef.current = null;
    }

    if (!user) {
      return;
    }

    const channel = supabase
      .channel(`profile-updates-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const currentUser = useAppStore.getState().user;
          if (!currentUser || currentUser.id !== user.id) {
            return;
          }

          const updatedProfile = payload.new as {
            role?: 'user' | 'admin' | 'developer';
            is_requesting_admin?: boolean;
            is_requesting_demote?: boolean;
          };

          setStoreUser({
            ...currentUser,
            role: updatedProfile.role ?? currentUser.role,
            isRequestingAdmin: updatedProfile.is_requesting_admin ?? currentUser.isRequestingAdmin,
            isRequestingDemote:
              updatedProfile.is_requesting_demote ?? currentUser.isRequestingDemote,
          });
        },
      )
      .subscribe();

    profileChannelRef.current = channel;

    return () => {
      if (profileChannelRef.current) {
        supabase.removeChannel(profileChannelRef.current);
        profileChannelRef.current = null;
      }
    };
  }, [user, setStoreUser]);

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
