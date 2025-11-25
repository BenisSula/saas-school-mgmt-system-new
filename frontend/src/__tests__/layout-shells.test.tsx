import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { BrandProvider } from '../components/ui/BrandProvider';
import { LandingShell } from '../layouts/LandingShell';
import { AdminShell } from '../layouts/AdminShell';
import { queryClient } from '../lib/react-query';

vi.mock('../lib/api', () => ({
  api: {
    getBranding: vi.fn().mockResolvedValue(null),
  },
}));

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => {
      const matches = query === '(min-width: 1024px)';
      return {
        matches,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    }),
  });
});

const renderWithBrand = (ui: React.ReactElement, initialEntries: string[] = ['/']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <BrandProvider>{ui}</BrandProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );

describe('Layout shells', () => {
  it('LandingShell renders marketing header without dashboard controls', async () => {
    renderWithBrand(
      <LandingShell>
        <div>Landing content</div>
      </LandingShell>
    );

    await screen.findByText(/Landing content/i);
    expect(screen.queryByLabelText(/Toggle navigation/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Sidebar navigation/i)).not.toBeInTheDocument();
  });

  it('AdminShell renders dashboard navigation and sidebar', async () => {
    renderWithBrand(
      <AdminShell
        user={{
          id: '1',
          email: 'admin@example.com',
          role: 'admin',
          tenantId: 'tenant',
          isVerified: true,
          status: 'active',
        }}
        onLogout={() => {}}
      >
        <div>Dashboard content</div>
      </AdminShell>,
      ['/dashboard/classes']
    );

    await screen.findByText(/Dashboard content/i);
    expect(screen.getByLabelText(/Toggle navigation/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Sidebar navigation/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: /Classes & subjects/i })
    ).toBeInTheDocument();
  });
});
