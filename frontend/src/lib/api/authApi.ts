/**
 * Authentication API Module
 * 
 * Centralized authentication-related API calls
 * Following DRY principles - single source of truth for auth operations
 */

/**
 * Authentication API Module
 * 
 * Centralized authentication-related API calls
 * Following DRY principles - single source of truth for auth operations
 * 
 * This module re-exports and extends the authApi from the main api module
 * to provide a cleaner, more focused API for authentication operations.
 */

import { authApi as baseAuthApi } from '../api';
import type { AuthResponse, Role } from '../api';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  role: Role;
  tenantId?: string;
  tenantName?: string;
  profile?: Record<string, unknown>;
}

export interface RefreshTokenInput {
  refreshToken: string;
}

/**
 * Authentication API functions
 */
export const authApi = {
  /**
   * Login user
   */
  login: baseAuthApi.login,

  /**
   * Register new user
   */
  register: baseAuthApi.register,

  /**
   * Refresh access token
   */
  refresh: baseAuthApi.refresh,

  /**
   * Refresh access token (alias for refresh)
   */
  refreshToken: async (_input: RefreshTokenInput): Promise<AuthResponse> => {
    const result = await baseAuthApi.refresh();
    if (!result) {
      throw new Error('Failed to refresh token');
    }
    return result;
  }
};

