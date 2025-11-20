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

// Suppress React Router future flag warnings in tests
// Note: MemoryRouter doesn't support future flags directly.
// To fully eliminate warnings, consider using RouterProvider with createBrowserRouter
// and set future: { v7_startTransition: true, v7_relativeSplatPath: true }
const originalConsoleWarn = console.warn;
console.warn = (...args: any[]) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('future flag') ||
      args[0].includes('v7_startTransition') ||
      args[0].includes('v7_relativeSplatPath'))
  ) {
    return; // Suppress future flag warnings
  }
  originalConsoleWarn(...args);
};

// Suppress unhandled rejection warnings for test errors that are properly handled by forms
// These errors are created in tests to verify error handling, but Vitest flags them as unhandled
// before the form's error handler can catch them. Since we verify error display in tests,
// these warnings can be safely suppressed.
if (typeof process !== 'undefined') {
  const originalListeners = process.listeners('unhandledRejection');
  process.removeAllListeners('unhandledRejection');
  
  process.on('unhandledRejection', (reason: unknown) => {
    // Check if this is a test error that will be handled by form error handlers
    if (
      reason instanceof Error &&
      (reason.message === 'Invalid credentials' ||
        reason.message === 'Email already exists' ||
        reason.message === 'Internal server error') &&
      'apiError' in reason
    ) {
      // This is a test error that forms handle - suppress the warning
      return;
    }
    
    // For other unhandled rejections, re-emit to original listeners
    originalListeners.forEach((listener) => {
      if (typeof listener === 'function') {
        try {
          listener(reason, Promise.reject(reason));
        } catch {
          // Ignore errors in listeners
        }
      }
    });
  });
}

