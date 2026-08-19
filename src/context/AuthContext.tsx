import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser, AuthStatusInfo } from '../types';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  statusInfo: AuthStatusInfo | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string, role?: 'admin' | 'editor') => Promise<{ success: boolean; error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; resetCode?: string; message?: string; error?: string }>;
  resetPassword: (email: string, resetCode: string, newPassword: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_STORAGE_KEY = 'rory_studio_auth_token_v1';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusInfo, setStatusInfo] = useState<AuthStatusInfo | null>(null);

  // Helper to build headers with Authorization Bearer fallback
  const getAuthHeaders = useCallback((): HeadersInit => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = sessionStorage.getItem(TOKEN_STORAGE_KEY) || localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, []);

  // Fetch current session and auth status from server
  const refreshAuth = useCallback(async () => {
    try {
      setIsLoading(true);

      // 1. Fetch public status info
      const statusRes = await fetch('/api/auth/status', {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (statusRes.ok) {
        const sData = await statusRes.json();
        setStatusInfo(sData);
      }

      // 2. Fetch current session (/api/auth/me)
      const meRes = await fetch('/api/auth/me', {
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.authenticated && meData.user) {
          setUser(meData.user);
        } else {
          setUser(null);
          sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      } else {
        setUser(null);
      }
    } catch (err) {
      console.warn('[AuthContext] Auth verification network notice:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  // Login handler
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Authentication failed. Please check your credentials.' };
      }

      if (data.token) {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      }
      setUser(data.user);
      await refreshAuth();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during sign in.' };
    }
  };

  // Register / Create Account handler
  const register = async (
    name: string,
    email: string,
    password: string,
    role: 'admin' | 'editor' = 'admin'
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, role }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to create account.' };
      }

      if (data.token) {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      }
      setUser(data.user);
      await refreshAuth();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during account registration.' };
    }
  };

  // Request password reset code handler
  const requestPasswordReset = async (
    email: string
  ): Promise<{ success: boolean; resetCode?: string; message?: string; error?: string }> => {
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to request password reset code.' };
      }

      return {
        success: true,
        resetCode: data.resetCode,
        message: data.message,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during password reset request.' };
    }
  };

  // Confirm password reset with verification code
  const resetPassword = async (
    email: string,
    resetCode: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string; message?: string }> => {
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          resetCode: resetCode.trim(),
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to reset password.' };
      }

      await refreshAuth();
      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during password reset.' };
    }
  };

  // Logout handler
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
    } catch (err) {
      console.error('[AuthContext] Logout error:', err);
    } finally {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setUser(null);
      await refreshAuth();
    }
  };

  // Change password handler
  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to update password.' };
      }

      await refreshAuth();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during password update.' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        statusInfo,
        login,
        register,
        requestPasswordReset,
        resetPassword,
        logout,
        changePassword,
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
