import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RegisterPage } from '../pages/auth/Register';
import AdminRoleManagementPage from '../pages/AdminRoleManagementPage';
import * as AuthContextModule from '../context/AuthContext';
import { api } from '../lib/api';
import { toast } from 'sonner';

type MockAuthState = {
  user: {
    id: string;
    email: string;
    role: string;
    tenantId: string;
    isVerified: boolean;
    status?: string;
  } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  register: Mock;
  login: Mock;
};

const mockAuthState = (AuthContextModule as unknown as { __mockAuthState: MockAuthState })
  .__mockAuthState;

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      listUsers: vi.fn(),
      listPendingUsers: vi.fn(),
      approveUser: vi.fn(),
      rejectUser: vi.fn(),
      updateUserRole: vi.fn()
    }
  };
});

describe('Auth flows', () => {
  beforeEach(() => {
    mockAuthState.user = null;
    mockAuthState.isAuthenticated = false;
    mockAuthState.isLoading = false;
    mockAuthState.register.mockReset();
    mockAuthState.login.mockReset();
    (toast.success as unknown as Mock).mockReset();
    (toast.error as unknown as Mock).mockReset();
    (toast.info as unknown as Mock).mockReset();
    (api.listUsers as unknown as Mock).mockReset();
    (api.listPendingUsers as unknown as Mock).mockReset();
    (api.approveUser as unknown as Mock).mockReset();
    (api.rejectUser as unknown as Mock).mockReset();
    (api.updateUserRole as unknown as Mock).mockReset();
  });

  it('shows pending status message after registration', async () => {
    const pendingResponse = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: '900s',
      user: {
        id: 'pending-user',
        email: 'teacher@example.com',
        role: 'teacher' as const,
        tenantId: 'tenant_alpha',
        isVerified: false,
        status: 'pending' as const
      }
    };

    mockAuthState.register.mockResolvedValueOnce(pendingResponse);

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/Work email/i), 'Teacher@Example.COM');
    await user.type(screen.getByLabelText(/Password/i), 'StrongPass123!');
    await user.type(screen.getByLabelText(/Tenant ID/i), 'Tenant_Beta');
    await user.click(screen.getByRole('button', { name: /Submit request/i }));

    await waitFor(() => expect(mockAuthState.register).toHaveBeenCalled());
    expect(mockAuthState.register).toHaveBeenCalledWith({
      email: 'teacher@example.com',
      password: 'StrongPass123!',
      role: 'teacher',
      tenantId: 'Tenant_Beta'
    });
    expect(toast.info).toHaveBeenCalledWith(
      'Account created and pending admin approval. We will notify you once activated.'
    );
  });

  it('allows admin to approve a pending user', async () => {
    (api.listUsers as unknown as Mock).mockResolvedValue([
      {
        id: 'active-user',
        email: 'admin@example.com',
        role: 'admin',
        is_verified: true,
        created_at: new Date().toISOString(),
        status: 'active'
      }
    ]);
    (api.listPendingUsers as unknown as Mock).mockResolvedValue([
      {
        id: 'pending-user',
        email: 'pending@example.com',
        role: 'teacher',
        is_verified: false,
        created_at: new Date('2024-05-01').toISOString(),
        status: 'pending'
      }
    ]);
    (api.approveUser as unknown as Mock).mockResolvedValue({
      id: 'pending-user',
      email: 'pending@example.com',
      role: 'teacher',
      is_verified: true,
      created_at: new Date('2024-05-01').toISOString(),
      status: 'active'
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminRoleManagementPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(api.listUsers).toHaveBeenCalled();
      expect(api.listPendingUsers).toHaveBeenCalled();
    });

    expect(screen.getByText(/pending@example.com/i, { selector: 'p' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Approve/i }));

    await waitFor(() => expect(api.approveUser).toHaveBeenCalledWith('pending-user'));

    await waitFor(() =>
      expect(screen.queryByText(/pending@example.com/i, { selector: 'p' })).not.toBeInTheDocument()
    );
    expect(toast.success).toHaveBeenCalledWith('pending@example.com approved.');
  });
});
