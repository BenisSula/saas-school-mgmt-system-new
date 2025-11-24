/**
 * Authentication Domain Types
 * 
 * Types related to authentication, shared between frontend and backend.
 */

export interface LoginRequest {
  email: string;
  password: string;
  tenantId?: string;
}

export interface LoginResponse {
  user: {
    id: string;
    email: string;
    role: string;
    tenantId?: string;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword: string;
  role: 'student' | 'teacher' | 'admin';
  tenantId?: string;
  tenantName?: string;
  // Additional profile fields based on role
  [key: string]: unknown;
}

export interface RegisterResponse {
  user: {
    id: string;
    email: string;
    role: string;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

