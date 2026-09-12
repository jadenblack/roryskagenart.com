import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  statusInfo: AuthStatusInfoLite | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

/** Minimal status surface kept for backward compatibility with existing UI */
interface AuthStatusInfoLite {
  authenticated: boolean;
  authEngine: string;
  emailProvider: string;
}

interface AuthStatusInfoAlias extends AuthStatusInfoLite {}
type AuthStatusInfo = AuthStatusInfoAlias;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Map a Supabase auth user to the app's AuthUser shape.
 * Role resolution order: profiles table (via RPC-less select) → user metadata → viewer.
 */
async function mapSupabaseUser(sbUser: any): Promise<AuthUser> {
  let role: AuthUser['role'] = 'viewer';
  let name: string = (sbUser.user_metadata?.name as string) || '';

  // Try to read the profile row. RLS allows users to read their own profile.
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', sbUser.id)
      .single();
    if (profile?.role === 'admin' || profile?.role === 'editor') {
      role = profile.role;
    } else if (profile?.role === 'viewer') {
      role = 'viewer';
    }
    if (profile?.full_name) name = profile.full_name;
  } catch {
    // Fall through to metadata below
  }

  if (role === 'viewer') {
    const metaRole = (sbUser.app_metadata?.role || sbUser.user_metadata?.role) as string | undefined;
    if (metaRole === 'admin' || metaRole === 'editor') role = metaRole;
  }

  return {
    id: sbUser.id,
    email: sbUser.email || '',
    name: name || 'Studio Admin',
    role,
    createdAt: sbUser.created_at || new Date().toISOString(),
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusInfo, setStatusInfo] = useState<AuthStatusInfo | null>({
    authenticated: false,
    authEngine: 'Supabase Auth',
    emailProvider: 'Resend',
  });

  const refreshAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!isSupabaseConfigured) {
        setUser(null);
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      if (sessionData?.session?.user) {
        const mapped = await mapSupabaseUser(sessionData.session.user);
        setUser(mapped);
        setStatusInfo({
          authenticated: true,
          authEngine: 'Supabase Auth',
          emailProvider: 'Resend',
        });
      } else {
        setUser(null);
        setStatusInfo({
          authenticated: false,
          authEngine: 'Supabase Auth',
          emailProvider: 'Resend',
        });
      }
    } catch (err) {
      console.warn('[AuthContext] Session refresh notice:', err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();

    if (isSupabaseConfigured) {
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          const mapped = await mapSupabaseUser(session.user);
          setUser(mapped);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, [refreshAuth]);

  const login = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      if (!isSupabaseConfigured) {
        return { success: false, error: 'Supabase is not configured on this deployment.' };
      }
      try {
        const cleanEmail = email.trim().toLowerCase();
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: password.trim(),
        });

        if (error) {
          return { success: false, error: error.message };
        }
        if (data?.user) {
          const mapped = await mapSupabaseUser(data.user);
          setUser(mapped);
          return { success: true };
        }
        return { success: false, error: 'Sign-in returned no user.' };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Network error during sign in.' };
      }
    },
    []
  );

  const requestPasswordReset = useCallback(
    async (email: string): Promise<{ success: boolean; message?: string; error?: string }> => {
      if (!isSupabaseConfigured) {
        return { success: false, error: 'Supabase is not configured on this deployment.' };
      }
      try {
        const cleanEmail = email.trim().toLowerCase();
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/#/admin/reset`,
        });
        if (error) {
          return { success: false, error: error.message };
        }
        return {
          success: true,
          message: `Password reset email sent to ${cleanEmail}. Check your inbox.`,
        };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Network error during password reset request.' };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[AuthContext] Supabase signOut notice:', err);
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        statusInfo,
        login,
        requestPasswordReset,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
