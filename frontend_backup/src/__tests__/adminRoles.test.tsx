import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardRouteProvider } from '../context/DashboardRouteContext';
import AdminRoleManagementPage from '../pages/admin/RoleManagementPage';

interface MockUser {
  id: string;
  email: string;
  role: string;
  is_verified: boolean;
  created_at: string;
}

describe('AdminRoleManagementPage', () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => [] as MockUser[]
  });
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    let users: MockUser[] = [
      {
        id: 'user-1',
        email: 'teacher@test.com',
        role: 'teacher',
        is_verified: true,
        created_at: '2025-01-01T00:00:00.000Z'
      }
    ];

    fetchMock.mockImplementation((input: string | URL, init?: globalThis.RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/users') && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => users
        });
      }
      if (url.includes('/users/user-1/role') && init?.method === 'PATCH') {
        users = [
          {
            ...users[0],
            role: 'admin'
          }
        ];
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => users[0]
        });
      }
      throw new Error(`Unhandled fetch call: ${url}`);
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = originalFetch;
  });

  it('lists users and updates role', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }
      }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <DashboardRouteProvider defaultTitle="Test">
          <AdminRoleManagementPage />
        </DashboardRouteProvider>
      </QueryClientProvider>
    );

    const roleSelect = await screen.findByRole('combobox');
    fireEvent.change(roleSelect, { target: { value: 'admin' } });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/users/user-1/role'),
        expect.objectContaining({
          method: 'PATCH'
        })
      )
    );

    expect(await screen.findByDisplayValue('admin')).toBeInTheDocument();
  });
});
