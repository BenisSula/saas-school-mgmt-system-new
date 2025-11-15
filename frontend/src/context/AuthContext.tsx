import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  authApi,
  clearSession,
  hydrateFromStorage,
  initialiseSession,
  setAuthHandlers,
  setTenant
} from '../lib/api';
import type { AuthResponse, AuthUser, LoginPayload, RegisterPayload } from '../lib/api';
import { normalizeUser, ensureActive, isActive } from '../lib/userUtils';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<AuthResponse>;
  register: (payload: RegisterPayload) => Promise<AuthResponse>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const handleUnauthorized = useCallback(() => {
    clearSession();
    setUser(null);
    toast.error('Your session has expired. Please sign in again.');
  }, []);

  const handleRefresh = useCallback((auth: AuthResponse) => {
    const normalised = normalizeUser(auth.user);
    try {
      ensureActive(normalised);
    } catch (error) {
      clearSession();
      setUser(null);
      toast.error((error as Error).message);
      return;
    }
    setUser(normalised);
    setTenant(normalised.tenantId ?? null);
  }, []);

  useEffect(() => {
    setAuthHandlers({
      onUnauthorized: handleUnauthorized,
      onRefresh: handleRefresh
    });
  }, [handleUnauthorized, handleRefresh]);

  useEffect(() => {
    const { refreshToken, tenantId } = hydrateFromStorage();
    if (tenantId) {
      setTenant(tenantId);
    }
    if (!refreshToken) {
      setIsLoading(false);
      return;
    }

    (async () => {
      try {
        const auth = await authApi.refresh();
        if (auth) {
          const normalised = normalizeUser(auth.user);
          try {
            ensureActive(normalised);
            setUser(normalised);
            setTenant(normalised.tenantId ?? null);
          } catch (error) {
            clearSession();
            setUser(null);
            toast.error((error as Error).message);
          }
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    setIsLoading(true);
    try {
      const auth = await authApi.login(payload);

      // Validate response structure
      if (!auth || !auth.user || !auth.accessToken) {
        throw new Error('Invalid response from server. Please try again.');
      }

      const normalised = normalizeUser(auth.user);

      // Check if user is active - if not, clear session and show error
      if (!isActive(normalised)) {
        clearSession();
        setUser(null);
        const statusLabel = normalised.status === 'pending' ? 'pending admin approval' : 'inactive';
        throw new Error(`Account ${statusLabel}. Please contact an administrator.`);
      }

      // User is active - initialize session and set user state
      const authWithStatus: AuthResponse = { ...auth, user: normalised };
      initialiseSession(authWithStatus);
      setTenant(normalised.tenantId ?? null);
      setUser(normalised);
      return authWithStatus;
    } catch (error) {
      // Log error for debugging
      console.error('[AuthContext] Login error:', error);
      // Re-throw to let the caller handle it (LoginForm will show the error)
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    setIsLoading(true);
    try {
      const auth = await authApi.register(payload);

      // Validate response structure
      if (!auth || !auth.user || !auth.accessToken) {
        throw new Error('Invalid response from server. Please try again.');
      }

      const normalised = normalizeUser(auth.user);
      const authWithStatus: AuthResponse = { ...auth, user: normalised };

      // Only initialize session if user is active
      if (!isActive(normalised)) {
        clearSession();
        setUser(null);
        return authWithStatus;
      }

      // User is active - initialize session and set user state
      initialiseSession(authWithStatus);
      setTenant(normalised.tenantId ?? null);
      setUser(normalised);
      return authWithStatus;
    } catch (error) {
      // Log error for debugging
      console.error('[AuthContext] Register error:', error);
      // Re-throw to let the caller handle it
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      register,
      logout
    }),
    [user, isLoading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
