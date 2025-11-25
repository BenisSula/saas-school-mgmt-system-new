import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import * as AuthContextModule from '../context/AuthContext';
import type { AuthUser } from '../lib/api';

// Mock the AuthContext
vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockUseAuth = AuthContextModule.useAuth as ReturnType<typeof vi.fn>;

describe('ProtectedRoute with Permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows access when user has required permission', () => {
    const mockUser: AuthUser = {
      id: '1',
      email: 'teacher@test.com',
      role: 'teacher',
      tenantId: 'tenant-1',
      isVerified: true,
      status: 'active',
    };

    mockUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
      isAuthenticated: true,
    });

    render(
      <MemoryRouter>
        <ProtectedRoute allowedPermissions={['attendance:mark']}>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('blocks access when user lacks required permission', () => {
    const mockUser: AuthUser = {
      id: '1',
      email: 'student@test.com',
      role: 'student',
      tenantId: 'tenant-1',
      isVerified: true,
      status: 'active',
    };

    mockUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
      isAuthenticated: true,
    });

    render(
      <MemoryRouter>
        <ProtectedRoute allowedPermissions={['attendance:mark']}>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    // ProtectedRoute shows "Redirecting..." when redirecting due to permission denial
    expect(screen.getByText(/Redirecting.../i)).toBeInTheDocument();
  });

  it('allows access when user has any of the required permissions (default behavior)', () => {
    const mockUser: AuthUser = {
      id: '1',
      email: 'teacher@test.com',
      role: 'teacher',
      tenantId: 'tenant-1',
      isVerified: true,
      status: 'active',
    };

    mockUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
      isAuthenticated: true,
    });

    render(
      <MemoryRouter>
        <ProtectedRoute allowedPermissions={['attendance:mark', 'users:manage']}>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('requires all permissions when requireAllPermissions is true', () => {
    const mockUser: AuthUser = {
      id: '1',
      email: 'teacher@test.com',
      role: 'teacher',
      tenantId: 'tenant-1',
      isVerified: true,
      status: 'active',
    };

    mockUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
      isAuthenticated: true,
    });

    render(
      <MemoryRouter>
        <ProtectedRoute
          allowedPermissions={['attendance:mark', 'users:manage']}
          requireAllPermissions={true}
        >
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    // Teacher has attendance:mark but not users:manage, so should be blocked
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('allows access when user has all required permissions', () => {
    const mockUser: AuthUser = {
      id: '1',
      email: 'admin@test.com',
      role: 'admin',
      tenantId: 'tenant-1',
      isVerified: true,
      status: 'active',
    };

    mockUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
      isAuthenticated: true,
    });

    render(
      <MemoryRouter>
        <ProtectedRoute
          allowedPermissions={['dashboard:view', 'users:manage']}
          requireAllPermissions={true}
        >
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('works with both roles and permissions (user must pass both checks)', () => {
    const mockUser: AuthUser = {
      id: '1',
      email: 'admin@test.com',
      role: 'admin',
      tenantId: 'tenant-1',
      isVerified: true,
      status: 'active',
    };

    mockUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
      isAuthenticated: true,
    });

    // Admin has users:manage permission, so should pass both role and permission checks
    render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={['admin']} allowedPermissions={['users:manage']}>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
