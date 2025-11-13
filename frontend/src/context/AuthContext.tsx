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
import type { AuthResponse, AuthUser, LoginPayload, RegisterPayload, UserStatus } from '../lib/api';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<AuthResponse>;
  register: (payload: RegisterPayload) => Promise<AuthResponse>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ACTIVE_STATUS: UserStatus = 'active';

function normaliseUser(user: AuthUser): AuthUser {
  return {
    ...user,
    status: user.status ?? ACTIVE_STATUS
  };
}

function ensureActive(user: AuthUser): void {
  if ((user.status ?? ACTIVE_STATUS) !== ACTIVE_STATUS) {
    const statusLabel = user.status === 'pending' ? 'pending admin approval' : 'inactive';
    throw new Error(`Account ${statusLabel}.`);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const handleUnauthorized = useCallback(() => {
    clearSession();
    setUser(null);
    toast.error('Your session has expired. Please sign in again.');
  }, []);

  const handleRefresh = useCallback((auth: AuthResponse) => {
    const normalised = normaliseUser(auth.user);
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
          const normalised = normaliseUser(auth.user);
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
      const normalised = normaliseUser(auth.user);
      ensureActive(normalised);
      const authWithStatus: AuthResponse = { ...auth, user: normalised };
      initialiseSession(authWithStatus);
      setTenant(normalised.tenantId ?? null);
      setUser(normalised);
      return authWithStatus;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    setIsLoading(true);
    try {
      const auth = await authApi.register(payload);
      const normalised = normaliseUser(auth.user);
      const authWithStatus: AuthResponse = { ...auth, user: normalised };
      if ((normalised.status ?? ACTIVE_STATUS) !== ACTIVE_STATUS) {
        clearSession();
        setUser(null);
        return authWithStatus;
      }
      initialiseSession(authWithStatus);
      setTenant(normalised.tenantId ?? null);
      setUser(normalised);
      return authWithStatus;
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
