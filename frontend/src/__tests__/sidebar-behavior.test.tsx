import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrandProvider } from '../components/ui/BrandProvider';
import { AdminShell } from '../layouts/AdminShell';
import { useSidebar } from '../hooks/useSidebar';
import { api } from '../lib/api';
import { queryClient } from '../lib/react-query';

function renderWithProviders(ui: React.ReactElement, initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <BrandProvider>{ui}</BrandProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query === '(min-width: 1024px)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    })
  });
});

describe('Sidebar role links', () => {
  it('renders admin-specific links', async () => {
    renderWithProviders(
      <AdminShell
        user={{
          id: 'admin-1',
          email: 'admin@example.com',
          role: 'admin',
          tenantId: 'tenant',
          isVerified: true,
          status: 'active'
        }}
        onLogout={() => {}}
      >
        <div>Content</div>
      </AdminShell>,
      ['/dashboard/classes']
    );

    await screen.findByText(/Content/i, { selector: 'div' });
    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'User management' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Classes & subjects' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'School settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Student profile (view)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Class Roster' })).not.toBeInTheDocument();
  });

  it('renders teacher-specific links', async () => {
    const listClassesSpy = vi.spyOn(api.teacher, 'listClasses').mockResolvedValue([]);
    const rosterSpy = vi.spyOn(api.teacher, 'getClassRoster').mockResolvedValue([]);

    renderWithProviders(
      <AdminShell
        user={{
          id: 'teacher-1',
          email: 'teacher@example.com',
          role: 'teacher',
          tenantId: 'tenant',
          isVerified: true,
          status: 'active'
        }}
        onLogout={() => {}}
      >
        <div>Teacher content</div>
      </AdminShell>,
      ['/dashboard/teacher/attendance']
    );

    await screen.findByText(/Teacher content/i);
    expect(screen.getByRole('button', { name: 'My Classes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exams & Grades' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Messages' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'School settings' })).not.toBeInTheDocument();

    listClassesSpy.mockRestore();
    rosterSpy.mockRestore();
  });

  it('renders student-specific links', async () => {
    renderWithProviders(
      <AdminShell
        user={{
          id: 'student-1',
          email: 'student@example.com',
          role: 'student',
          tenantId: 'tenant',
          isVerified: true,
          status: 'active'
        }}
        onLogout={() => {}}
      >
        <div>Student content</div>
      </AdminShell>,
      ['/dashboard/student/results']
    );

    await screen.findByText(/Student content/i);
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Results' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Attendance' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Users' })).not.toBeInTheDocument();
  });

  it('renders superuser-specific links', async () => {
    renderWithProviders(
      <AdminShell
        user={{
          id: 'super-1',
          email: 'owner@example.com',
          role: 'superadmin',
          tenantId: null,
          isVerified: true,
          status: 'active'
        }}
        onLogout={() => {}}
      >
        <div>Superuser content</div>
      </AdminShell>,
      ['/dashboard/superuser/overview']
    );

    await screen.findByText(/Superuser content/i);
    expect(screen.getByRole('button', { name: 'Dashboard Overview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage Schools' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subscription & Billing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Platform Settings' })).toBeInTheDocument();
  });
});

describe('Sidebar persistence', () => {
  function TestSidebarPersistence({ storageKey }: { storageKey: string }) {
    const { collapsed, toggleCollapsed } = useSidebar({
      storageKey: storageKey,
      initialOpen: true
    });
    return (
      <button type="button" onClick={toggleCollapsed}>
        {collapsed ? 'collapsed' : 'expanded'}
      </button>
    );
  }

  it('persists collapsed state per user', () => {
    const { rerender } = render(
      <MemoryRouter>
        <TestSidebarPersistence storageKey="user-a" />
      </MemoryRouter>
    );

    const button = screen.getByRole('button', { name: /expanded/i });
    fireEvent.click(button);
    expect(window.localStorage.getItem('saas-sidebar-collapsed:user-a')).toBe('true');

    rerender(
      <MemoryRouter>
        <TestSidebarPersistence storageKey="user-a" />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /collapsed/i })).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <TestSidebarPersistence storageKey="user-b" />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /expanded/i })).toBeInTheDocument();
  });
});

describe('Content area layout', () => {
  it('prevents horizontal scrolling', async () => {
    renderWithProviders(
      <AdminShell
        user={{
          id: 'admin-1',
          email: 'admin@example.com',
          role: 'admin',
          tenantId: 'tenant',
          isVerified: true,
          status: 'active'
        }}
        onLogout={() => {}}
      >
        <div>Scrollable content</div>
      </AdminShell>,
      ['/dashboard/overview']
    );

    await screen.findByText(/Scrollable content/i);
    const main = document.querySelector('main');
    expect(main).not.toBeNull();
    expect(main).toHaveClass('overflow-x-hidden');
    expect(main).toHaveClass('overflow-y-auto');
  });
});
