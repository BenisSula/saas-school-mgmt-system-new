import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermission, useAnyPermission, useAllPermissions } from '../hooks/usePermission';
import * as AuthContextModule from '../context/AuthContext';
import type { AuthUser } from '../lib/api';

// Mock the AuthContext
vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn()
}));

const mockUseAuth = AuthContextModule.useAuth as ReturnType<typeof vi.fn>;

describe('usePermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when user has the permission', () => {
    const mockUser: AuthUser = {
      id: '1',
      email: 'teacher@test.com',
      role: 'teacher',
      tenantId: 'tenant-1',
      isVerified: true,
      status: 'active'
    };

    mockUseAuth.mockReturnValue({ user: mockUser });

    const { result } = renderHook(() => usePermission('attendance:mark'));
    expect(result.current).toBe(true);
  });

  it('returns false when user does not have the permission', () => {
    const mockUser: AuthUser = {
      id: '1',
      email: 'student@test.com',
      role: 'student',
      tenantId: 'tenant-1',
      isVerified: true,
      status: 'active'
    };

    mockUseAuth.mockReturnValue({ user: mockUser });

    const { result } = renderHook(() => usePermission('attendance:mark'));
    expect(result.current).toBe(false);
  });

  it('returns false when user is null', () => {
    mockUseAuth.mockReturnValue({ user: null });

    const { result } = renderHook(() => usePermission('attendance:mark'));
    expect(result.current).toBe(false);
  });

  it('returns true for admin with users:manage permission', () => {
    const mockUser: AuthUser = {
      id: '1',
      email: 'admin@test.com',
      role: 'admin',
      tenantId: 'tenant-1',
      isVerified: true,
      status: 'active'
    };

    mockUseAuth.mockReturnValue({ user: mockUser });

    const { result } = renderHook(() => usePermission('users:manage'));
    expect(result.current).toBe(true);
  });
});

describe('useAnyPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when user has at least one permission', () => {
    const mockUser: AuthUser = {
      id: '1',
      email: 'teacher@test.com',
      role: 'teacher',
      tenantId: 'tenant-1',
      isVerified: true,
      status: 'active'
    };

    mockUseAuth.mockReturnValue({ user: mockUser });

    const { result } = renderHook(() => useAnyPermission(['attendance:mark', 'users:manage']));
    expect(result.current).toBe(true);
  });

  it('returns false when user has none of the permissions', () => {
    const mockUser: AuthUser = {
      id: '1',
      email: 'student@test.com',
      role: 'student',
      tenantId: 'tenant-1',
      isVerified: true,
      status: 'active'
    };

    mockUseAuth.mockReturnValue({ user: mockUser });

    const { result } = renderHook(() => useAnyPermission(['attendance:mark', 'users:manage']));
    expect(result.current).toBe(false);
  });

  it('returns false when permissions array is empty', () => {
    const mockUser: AuthUser = {
      id: '1',
      email: 'teacher@test.com',
      role: 'teacher',
      tenantId: 'tenant-1',
      isVerified: true,
      status: 'active'
    };

    mockUseAuth.mockReturnValue({ user: mockUser });

    const { result } = renderHook(() => useAnyPermission([]));
    expect(result.current).toBe(false);
  });
});

describe('useAllPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when user has all permissions', () => {
    const mockUser: AuthUser = {
      id: '1',
      email: 'admin@test.com',
      role: 'admin',
      tenantId: 'tenant-1',
      isVerified: true,
      status: 'active'
    };

    mockUseAuth.mockReturnValue({ user: mockUser });

    const { result } = renderHook(() => useAllPermissions(['dashboard:view', 'users:manage']));
    expect(result.current).toBe(true);
  });

  it('returns false when user is missing at least one permission', () => {
    const mockUser: AuthUser = {
      id: '1',
      email: 'teacher@test.com',
      role: 'teacher',
      tenantId: 'tenant-1',
      isVerified: true,
      status: 'active'
    };

    mockUseAuth.mockReturnValue({ user: mockUser });

    const { result } = renderHook(() => useAllPermissions(['attendance:mark', 'users:manage']));
    expect(result.current).toBe(false);
  });
});
