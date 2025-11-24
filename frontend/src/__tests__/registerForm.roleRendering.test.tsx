import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RegisterForm } from '../components/auth/RegisterForm';

// Mock AuthContext
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    register: vi.fn(),
  }),
}));

// Mock API for TenantSelector - use vi.hoisted to ensure mocks are available when vi.mock is hoisted
const { mockListSchools, mockLookupTenant } = vi.hoisted(() => {
  return {
    mockListSchools: vi.fn(),
    mockLookupTenant: vi.fn(),
  };
});

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

describe('RegisterForm - Role-based Field Rendering', () => {
  beforeEach(() => {
    mockListSchools.mockResolvedValue({
      schools: [],
      count: 0,
      total: 0,
      type: 'recent' as const,
    });
    mockLookupTenant.mockResolvedValue(null);
  });
  it('should render student-specific fields when role is student', async () => {
    const validTenantId = '123e4567-e89b-12d3-a456-426614174000';
    render(
      <MemoryRouter>
        <RegisterForm defaultRole="student" defaultTenantId={validTenantId} />
      </MemoryRouter>
    );

    // Wait for TenantSelector to finish loading
    await waitFor(() => {
      expect(mockListSchools).toHaveBeenCalled();
    });

    // Student-specific fields should be visible
    expect(await screen.findByLabelText(/date of birth/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/parent\/guardian name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/parent\/guardian contact/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/student id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/class \/ grade/i)).toBeInTheDocument();

    // Teacher-specific fields should NOT be visible
    expect(screen.queryByLabelText(/phone number/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/qualifications/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/years of experience/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/subject\(s\) taught/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/teacher id/i)).not.toBeInTheDocument();
  });

  it('should render teacher-specific fields when role is teacher', async () => {
    const validTenantId = '223e4567-e89b-12d3-a456-426614174001';
    render(
      <MemoryRouter>
        <RegisterForm defaultRole="teacher" defaultTenantId={validTenantId} />
      </MemoryRouter>
    );

    // Wait for TenantSelector to finish loading
    await waitFor(() => {
      expect(mockListSchools).toHaveBeenCalled();
    });

    // Teacher-specific fields should be visible
    expect(await screen.findByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/qualifications/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/years of experience/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/subject\(s\) taught/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/teacher id/i)).toBeInTheDocument();

    // Student-specific fields should NOT be visible
    expect(screen.queryByLabelText(/date of birth/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/parent\/guardian name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/parent\/guardian contact/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/student id/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/class \/ grade/i)).not.toBeInTheDocument();
  });

  it('should render common fields for both roles', async () => {
    const validTenantId = '323e4567-e89b-12d3-a456-426614174002';
    const { rerender } = render(
      <MemoryRouter>
        <RegisterForm defaultRole="student" defaultTenantId={validTenantId} />
      </MemoryRouter>
    );

    // Wait for TenantSelector to finish loading
    await waitFor(() => {
      expect(mockListSchools).toHaveBeenCalled();
    });

    // Common fields should be visible for student
    expect(await screen.findByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/create a secure password/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/re-enter your password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/gender/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/address/i)).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <RegisterForm defaultRole="teacher" defaultTenantId={validTenantId} />
      </MemoryRouter>
    );

    // Wait for role change to take effect
    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    });

    // Common fields should still be visible for teacher
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/create a secure password/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/re-enter your password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/gender/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/address/i)).toBeInTheDocument();
  });

  it('should render tenant selector for student and teacher', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <RegisterForm defaultRole="student" />
      </MemoryRouter>
    );

    // Wait for TenantSelector to load
    await waitFor(() => {
      expect(mockListSchools).toHaveBeenCalled();
    });

    expect(await screen.findByText(/search for your school/i)).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <RegisterForm defaultRole="teacher" />
      </MemoryRouter>
    );

    // Wait for TenantSelector to load after rerender
    await waitFor(() => {
      expect(screen.getByText(/search for your school/i)).toBeInTheDocument();
    });
  });
});
