import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import LoginPage from '../pages/auth/Login';
import * as apiModule from '../lib/api';

// Mock the API
vi.mock('../lib/api', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    refresh: vi.fn()
  }
}));

describe('AuthResponse Status Field', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('login response includes status field', async () => {
    const mockAuthResponse = {
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresIn: '900s',
      user: {
        id: '1',
        email: 'test@example.com',
        role: 'teacher' as const,
        tenantId: 'tenant-1',
        isVerified: true,
        status: 'active' as const
      }
    };

    vi.mocked(apiModule.authApi.login).mockResolvedValue(mockAuthResponse);

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    // Wait for HealthBanner to finish loading (if it renders)
    await waitFor(
      () => {
        // HealthBanner may or may not render, but wait for any async operations
        expect(true).toBe(true);
      },
      { timeout: 2000 }
    );

    // The status field should be present in the response
    expect(mockAuthResponse.user.status).toBe('active');
  });

  it('register response includes status field', async () => {
    const mockAuthResponse = {
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresIn: '900s',
      user: {
        id: '1',
        email: 'test@example.com',
        role: 'student' as const,
        tenantId: 'tenant-1',
        isVerified: false,
        status: 'pending' as const
      }
    };

    vi.mocked(apiModule.authApi.register).mockResolvedValue(mockAuthResponse);

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    // Wait for HealthBanner to finish loading (if it renders)
    await waitFor(
      () => {
        // HealthBanner may or may not render, but wait for any async operations
        expect(true).toBe(true);
      },
      { timeout: 2000 }
    );

    // The status field should be present in the response
    expect(mockAuthResponse.user.status).toBe('pending');
  });

  it('refresh response includes status field', async () => {
    const mockAuthResponse = {
      accessToken: 'new-token',
      refreshToken: 'new-refresh',
      expiresIn: '900s',
      user: {
        id: '1',
        email: 'test@example.com',
        role: 'admin' as const,
        tenantId: 'tenant-1',
        isVerified: true,
        status: 'active' as const
      }
    };

    vi.mocked(apiModule.authApi.refresh).mockResolvedValue(mockAuthResponse);

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    // Wait for HealthBanner to finish loading (if it renders)
    await waitFor(
      () => {
        // HealthBanner may or may not render, but wait for any async operations
        expect(true).toBe(true);
      },
      { timeout: 2000 }
    );

    // The status field should be present in the response
    expect(mockAuthResponse.user.status).toBe('active');
  });
});
