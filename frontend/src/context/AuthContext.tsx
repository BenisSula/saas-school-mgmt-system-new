import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
import { getAuthErrorMessage, type AuthErrorCode } from '../lib/authErrorCodes';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHealthChecking: boolean;
  login: (payload: LoginPayload) => Promise<AuthResponse>;
  register: (payload: RegisterPayload) => Promise<AuthResponse>;
  logout: () => void;
  checkBackendHealth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Track if we're already initializing to prevent duplicate initialization
let isInitializing = false;
// Track refresh timer to prevent duplicates
let refreshTimerId: ReturnType<typeof setTimeout> | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isHealthChecking, setIsHealthChecking] = useState<boolean>(false);
  const initializationAttempted = useRef<boolean>(false);
  const healthCheckAttempted = useRef<boolean>(false);

  /**
   * Clear any existing refresh timer to prevent duplicates
   */
  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerId !== null) {
      clearTimeout(refreshTimerId);
      refreshTimerId = null;
    }
  }, []);

  const handleUnauthorized = useCallback(() => {
    clearRefreshTimer();
    clearSession();
    setUser(null);
    const errorInfo = getAuthErrorMessage({ code: 'SESSION_EXPIRED' });
    toast.error(errorInfo.message);
  }, [clearRefreshTimer]);

  const handleRefresh = useCallback(
    (auth: AuthResponse) => {
      const normalised = normalizeUser(auth.user);
      try {
        ensureActive(normalised);
      } catch (error) {
        clearRefreshTimer();
        clearSession();
        setUser(null);
        const errorInfo = getAuthErrorMessage(error);
        toast.error(errorInfo.message);
        return;
      }
      setUser(normalised);
      setTenant(normalised.tenantId ?? null);
    },
    [clearRefreshTimer]
  );

  /**
   * Check backend health before attempting authentication
   * This helps provide better error messages if backend is down
   */
  const checkBackendHealth = useCallback(async (): Promise<boolean> => {
    if (healthCheckAttempted.current) {
      return true; // Already checked, assume healthy
    }

    setIsHealthChecking(true);
    healthCheckAttempted.current = true;

    try {
      // Use the health endpoint via api client
      const response = await fetch('/api/auth/health', {
        method: 'GET',
        credentials: 'include'
      });
      const isHealthy = response.ok;
      if (!isHealthy) {
        console.warn('[AuthContext] Backend health check failed');
      }
      return isHealthy;
    } catch (error) {
      console.error('[AuthContext] Backend health check error:', error);
      return false;
    } finally {
      setIsHealthChecking(false);
    }
  }, []);

  useEffect(() => {
    setAuthHandlers({
      onUnauthorized: handleUnauthorized,
      onRefresh: handleRefresh
    });
  }, [handleUnauthorized, handleRefresh]);

  /**
   * Initialize session from storage on mount
   * Includes backend health check and prevents duplicate initialization
   */
  useEffect(() => {
    // Prevent duplicate initialization (SSR/CSR compatibility)
    if (initializationAttempted.current || isInitializing) {
      return;
    }

    initializationAttempted.current = true;
    isInitializing = true;

    (async () => {
      try {
        // Check backend health first (non-blocking)
        await checkBackendHealth();

        const { refreshToken, tenantId } = hydrateFromStorage();
        if (tenantId) {
          setTenant(tenantId);
        }

        if (!refreshToken) {
          setIsLoading(false);
          isInitializing = false;
          return;
        }

        // Attempt to refresh session
        const auth = await authApi.refresh();
        if (auth) {
          const normalised = normalizeUser(auth.user);
          try {
            ensureActive(normalised);
            setUser(normalised);
            setTenant(normalised.tenantId ?? null);
          } catch (error) {
            clearRefreshTimer();
            clearSession();
            setUser(null);
            const errorInfo = getAuthErrorMessage(error);
            toast.error(errorInfo.message);
          }
        } else {
          // No auth returned - session invalid
          clearRefreshTimer();
          clearSession();
          setUser(null);
        }
      } catch (error) {
        // Refresh failed - clear session
        clearRefreshTimer();
        clearSession();
        setUser(null);
        console.error('[AuthContext] Session initialization error:', error);
      } finally {
        setIsLoading(false);
        isInitializing = false;
      }
    })();

    // Cleanup on unmount
    return () => {
      clearRefreshTimer();
    };
  }, [checkBackendHealth, clearRefreshTimer, handleUnauthorized]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      setIsLoading(true);
      clearRefreshTimer(); // Clear any existing timer

      try {
        const auth = await authApi.login(payload);

        // Validate response structure
        if (!auth || !auth.user || !auth.accessToken) {
          const errorInfo = getAuthErrorMessage({ code: 'INTERNAL_ERROR' });
          throw new Error(errorInfo.message);
        }

        const normalised = normalizeUser(auth.user);

        // Check if user is active - if not, clear session and show error
        if (!isActive(normalised)) {
          clearRefreshTimer();
          clearSession();
          setUser(null);

          // Map status to error code
          let errorCode: AuthErrorCode = 'ACCOUNT_PENDING';
          if (normalised.status === 'suspended') {
            errorCode = 'ACCOUNT_SUSPENDED';
          } else if (normalised.status === 'rejected') {
            errorCode = 'ACCOUNT_REJECTED';
          } else if (!normalised.isVerified) {
            errorCode = 'EMAIL_UNVERIFIED';
          }

          const errorInfo = getAuthErrorMessage({ code: errorCode });
          throw new Error(errorInfo.message);
        }

        // User is active - initialize session and set user state
        const authWithStatus: AuthResponse = { ...auth, user: normalised };
        initialiseSession(authWithStatus);
        setTenant(normalised.tenantId ?? null);
        setUser(normalised);
        return authWithStatus;
      } catch (error) {
        // Cancel session on failed login
        clearRefreshTimer();
        clearSession();
        setUser(null);

        // Log error for debugging
        console.error('[AuthContext] Login error:', error);

        // Map error to user-friendly message
        const errorInfo = getAuthErrorMessage(error);
        const mappedError = new Error(errorInfo.message);
        (mappedError as any).code = errorInfo.code;
        (mappedError as any).userAction = errorInfo.userAction;

        // Re-throw mapped error
        throw mappedError;
      } finally {
        setIsLoading(false);
      }
    },
    [clearRefreshTimer]
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      setIsLoading(true);
      clearRefreshTimer(); // Clear any existing timer

      try {
        const auth = await authApi.register(payload);

        // Validate response structure
        if (!auth || !auth.user || !auth.accessToken) {
          const errorInfo = getAuthErrorMessage({ code: 'INTERNAL_ERROR' });
          throw new Error(errorInfo.message);
        }

        const normalised = normalizeUser(auth.user);
        const authWithStatus: AuthResponse = { ...auth, user: normalised };

        // Only initialize session if user is active
        if (!isActive(normalised)) {
          clearRefreshTimer();
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
        // Cancel session on failed registration
        clearRefreshTimer();
        clearSession();
        setUser(null);

        // Log error for debugging
        console.error('[AuthContext] Register error:', error);

        // Map error to user-friendly message
        const errorInfo = getAuthErrorMessage(error);
        const mappedError = new Error(errorInfo.message);
        (mappedError as any).code = errorInfo.code;
        (mappedError as any).userAction = errorInfo.userAction;

        // Re-throw mapped error
        throw mappedError;
      } finally {
        setIsLoading(false);
      }
    },
    [clearRefreshTimer]
  );

  const logout = useCallback(() => {
    clearRefreshTimer();
    clearSession();
    setUser(null);
    toast.success('Signed out successfully');
  }, [clearRefreshTimer]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      isHealthChecking,
      login,
      register,
      logout,
      checkBackendHealth
    }),
    [user, isLoading, isHealthChecking, login, register, logout, checkBackendHealth]
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
