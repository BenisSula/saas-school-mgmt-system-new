import React from 'react';
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3001');

vi.mock('./src/context/AuthContext', () => {
  const mockAuthState = {
    user: {
      id: 'test-user',
      email: 'test@example.com',
      role: 'admin',
      tenantId: 'tenant_alpha',
      isVerified: true,
      status: 'active' as const
    },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn()
  };
  return {
    AuthProvider: ({ children }: { children: React.ReactNode }) => children,
    useAuth: () => mockAuthState,
    __mockAuthState: mockAuthState
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  }
}));

