import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type React from 'react';
import { useLoginForm } from '../hooks/useLoginForm';

// Mock AuthContext
const mockLogin = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin
  })
}));

describe('useLoginForm', () => {
  beforeEach(() => {
    mockLogin.mockReset();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useLoginForm());

    expect(result.current.values.email).toBe('');
    expect(result.current.values.password).toBe('');
    expect(result.current.fieldErrors).toEqual({});
    expect(result.current.submitting).toBe(false);
  });

  it('should initialize with provided initial values', () => {
    const { result } = renderHook(() =>
      useLoginForm({
        initialValues: {
          email: 'test@example.com',
          password: 'password123'
        }
      })
    );

    expect(result.current.values.email).toBe('test@example.com');
    expect(result.current.values.password).toBe('password123');
  });

  it('should update values when setValue is called', () => {
    const { result } = renderHook(() => useLoginForm());

    act(() => {
      result.current.setValue('email', 'new@example.com');
    });

    expect(result.current.values.email).toBe('new@example.com');
  });

  it('should validate email format', async () => {
    const { result } = renderHook(() => useLoginForm());

    act(() => {
      result.current.setValue('email', 'invalid-email');
      result.current.setValue('password', 'password123');
    });

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn()
      } as unknown as React.FormEvent);
    });

    await waitFor(() => {
      expect(result.current.fieldErrors.email).toBeDefined();
      expect(result.current.fieldErrors.email).toContain('valid email');
    });
  });

  it('should validate password is required', async () => {
    const { result } = renderHook(() => useLoginForm());

    act(() => {
      result.current.setValue('email', 'test@example.com');
      result.current.setValue('password', '');
    });

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn()
      } as unknown as React.FormEvent);
    });

    await waitFor(() => {
      expect(result.current.fieldErrors.password).toBeDefined();
    });
  });

  it('should call login with normalized email on successful validation', async () => {
    const mockAuthResponse = {
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresIn: '900s',
      user: {
        id: '1',
        email: 'test@example.com',
        role: 'student' as const,
        tenantId: 'tenant-1',
        isVerified: true,
        status: 'active' as const
      }
    };

    mockLogin.mockResolvedValue(mockAuthResponse);

    const { result } = renderHook(() =>
      useLoginForm({
        onSuccess: vi.fn()
      })
    );

    act(() => {
      result.current.setValue('email', '  Test@Example.COM  ');
      result.current.setValue('password', 'password123');
    });

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn()
      } as unknown as React.FormEvent);
    });

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com', // Normalized to lowercase
        password: 'password123'
      });
    });
  });

  it('should map API errors to field errors', async () => {
    const apiError = new Error('Invalid credentials') as Error & {
      apiError?: { status: string; message: string; field?: string; code?: string };
    };
    apiError.apiError = {
      status: 'error',
      message: 'Invalid credentials',
      field: 'password',
      code: 'INVALID_CREDENTIALS'
    };

    mockLogin.mockRejectedValue(apiError);

    const { result } = renderHook(() => useLoginForm());

    act(() => {
      result.current.setValue('email', 'test@example.com');
      result.current.setValue('password', 'wrongpassword');
    });

    await act(async () => {
      try {
        await result.current.handleSubmit({
          preventDefault: vi.fn()
        } as unknown as React.FormEvent);
      } catch {
        // Expected error, ignore
      }
    });

    await waitFor(
      () => {
        expect(result.current.fieldErrors.password).toBeDefined();
      },
      { timeout: 3000 }
    );
  });

  it('should clear field errors when value changes', () => {
    const { result } = renderHook(() => useLoginForm());

    act(() => {
      result.current.setFieldError('email', 'Invalid email');
    });

    expect(result.current.fieldErrors.email).toBe('Invalid email');

    act(() => {
      result.current.setValue('email', 'new@example.com');
    });

    expect(result.current.fieldErrors.email).toBeUndefined();
  });
});
