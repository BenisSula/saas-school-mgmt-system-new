import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type React from 'react';
import { useRegisterForm } from '../hooks/useRegisterForm';

// Mock AuthContext
const mockRegister = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    register: mockRegister,
  }),
}));

// Mock API for TenantSelector (used by useRegisterForm)
const mockListSchools = vi.fn();
const mockLookupTenant = vi.fn();

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      listSchools: mockListSchools,
      lookupTenant: mockLookupTenant,
    },
  };
});

describe('useRegisterForm', () => {
  beforeEach(() => {
    mockRegister.mockReset();
    mockListSchools.mockReset();
    mockLookupTenant.mockReset();

    // Default mock for listSchools
    mockListSchools.mockResolvedValue({
      schools: [],
      count: 0,
      total: 0,
      type: 'recent' as const,
    });

    // Default mock for lookupTenant
    mockLookupTenant.mockResolvedValue(null);
  });

  it('should initialize with default values for student', () => {
    const { result } = renderHook(() => useRegisterForm({ defaultRole: 'student' }));

    expect(result.current.values.email).toBe('');
    expect(result.current.values.password).toBe('');
    expect(result.current.values.fullName).toBe('');
    expect(result.current.validatedRole).toBe('student');
    expect(result.current.isStudent).toBe(true);
    expect(result.current.isTeacher).toBe(false);
  });

  it('should initialize with default values for teacher', () => {
    const { result } = renderHook(() => useRegisterForm({ defaultRole: 'teacher' }));

    expect(result.current.validatedRole).toBe('teacher');
    expect(result.current.isStudent).toBe(false);
    expect(result.current.isTeacher).toBe(true);
  });

  it('should validate student registration with all required fields', async () => {
    const validTenantId = '123e4567-e89b-12d3-a456-426614174000';
    const { result } = renderHook(() =>
      useRegisterForm({
        defaultRole: 'student',
        defaultTenantId: validTenantId,
      })
    );

    // Verify tenantId is set
    expect(result.current.tenantId).toBe(validTenantId);

    act(() => {
      result.current.setValue('email', 'student@example.com');
      result.current.setValue('password', 'StrongPass123!');
      result.current.setValue('confirmPassword', 'StrongPass123!');
      result.current.setValue('fullName', 'John Doe');
      result.current.setValue('gender', 'male');
      result.current.setValue('dateOfBirth', '2010-01-01');
      result.current.setValue('parentGuardianName', 'Parent Name');
      result.current.setValue('parentGuardianContact', '+1234567890');
      result.current.setValue('classId', 'class-1');
      result.current.setValue('address', '123 Main Street, City, State');
    });

    const mockAuthResponse = {
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresIn: '900s',
      user: {
        id: '1',
        email: 'student@example.com',
        role: 'student' as const,
        tenantId: validTenantId,
        isVerified: false,
        status: 'pending' as const,
      },
    };

    mockRegister.mockResolvedValue(mockAuthResponse);

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent<HTMLFormElement>);
    });

    await waitFor(
      () => {
        expect(mockRegister).toHaveBeenCalled();
      },
      { timeout: 5000 }
    );
  });

  it('should validate teacher registration with all required fields', async () => {
    const validTenantId = '223e4567-e89b-12d3-a456-426614174001';
    const { result } = renderHook(() =>
      useRegisterForm({
        defaultRole: 'teacher',
        defaultTenantId: validTenantId,
      })
    );

    // Verify tenantId is set
    expect(result.current.tenantId).toBe(validTenantId);

    act(() => {
      result.current.setValue('email', 'teacher@example.com');
      result.current.setValue('password', 'StrongPass123!');
      result.current.setValue('confirmPassword', 'StrongPass123!');
      result.current.setValue('fullName', 'Jane Smith');
      result.current.setValue('gender', 'female');
      result.current.setValue('phone', '+1234567890');
      result.current.setValue('qualifications', 'B.Ed, M.Sc Mathematics');
      result.current.setValue('yearsOfExperience', '5');
      result.current.setValue('subjects', ['mathematics']);
      result.current.setValue('address', '456 Oak Avenue, City, State');
    });

    const mockAuthResponse = {
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresIn: '900s',
      user: {
        id: '2',
        email: 'teacher@example.com',
        role: 'teacher' as const,
        tenantId: validTenantId,
        isVerified: false,
        status: 'pending' as const,
      },
    };

    mockRegister.mockResolvedValue(mockAuthResponse);

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent<HTMLFormElement>);
    });

    await waitFor(
      () => {
        expect(mockRegister).toHaveBeenCalled();
      },
      { timeout: 5000 }
    );
  });

  it('should reject registration without tenantId for student', async () => {
    const { result } = renderHook(() => useRegisterForm({ defaultRole: 'student' }));

    // Verify tenantId is null
    expect(result.current.tenantId).toBeNull();

    act(() => {
      result.current.setValue('email', 'student@example.com');
      result.current.setValue('password', 'StrongPass123!');
      result.current.setValue('confirmPassword', 'StrongPass123!');
      result.current.setValue('fullName', 'John Doe');
    });

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent<HTMLFormElement>);
    });

    await waitFor(() => {
      expect(result.current.fieldErrors.tenantId).toBeDefined();
      expect(result.current.fieldErrors.tenantId).toContain('school/institution');
    });
  });

  it('should handle tenant selection', () => {
    const validTenantId = '423e4567-e89b-12d3-a456-426614174003';
    const { result } = renderHook(() => useRegisterForm({ defaultRole: 'student' }));

    act(() => {
      result.current.handleTenantSelect(validTenantId, {
        id: validTenantId,
        name: 'Test School',
        domain: null,
        registrationCode: 'TEST123',
      });
    });

    expect(result.current.tenantId).toBe(validTenantId);
    expect(result.current.selectedTenant?.name).toBe('Test School');
  });

  it('should call onPending when user status is pending', async () => {
    const validTenantId = '323e4567-e89b-12d3-a456-426614174002';
    const onPending = vi.fn();
    const { result } = renderHook(() =>
      useRegisterForm({
        defaultRole: 'student',
        defaultTenantId: validTenantId,
        onPending,
      })
    );

    // Verify tenantId is set
    expect(result.current.tenantId).toBe(validTenantId);

    act(() => {
      result.current.setValue('email', 'student@example.com');
      result.current.setValue('password', 'StrongPass123!');
      result.current.setValue('confirmPassword', 'StrongPass123!');
      result.current.setValue('fullName', 'John Doe');
      result.current.setValue('gender', 'male');
      result.current.setValue('dateOfBirth', '2010-01-01');
      result.current.setValue('parentGuardianName', 'Parent Name');
      result.current.setValue('parentGuardianContact', '+1234567890');
      result.current.setValue('classId', 'class-1');
      result.current.setValue('address', '123 Main Street, City, State');
    });

    const mockAuthResponse = {
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresIn: '900s',
      user: {
        id: '1',
        email: 'student@example.com',
        role: 'student' as const,
        tenantId: validTenantId,
        isVerified: false,
        status: 'pending' as const,
      },
    };

    mockRegister.mockResolvedValue(mockAuthResponse);

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent<HTMLFormElement>);
    });

    await waitFor(
      () => {
        expect(onPending).toHaveBeenCalledWith(mockAuthResponse);
      },
      { timeout: 5000 }
    );
  });
});
