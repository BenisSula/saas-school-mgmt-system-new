import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QuickActionPanel } from '../components/admin/QuickActionPanel';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('QuickActionPanel', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders all quick action buttons', () => {
    render(
      <MemoryRouter>
        <QuickActionPanel />
      </MemoryRouter>
    );

    expect(screen.getByText(/Quick Actions/i)).toBeInTheDocument();
    expect(screen.getByText(/Register New Teacher/i)).toBeInTheDocument();
    expect(screen.getByText(/Register New Student/i)).toBeInTheDocument();
    expect(screen.getByText(/Create Class/i)).toBeInTheDocument();
    expect(screen.getByText(/Upload CSV/i)).toBeInTheDocument();
    expect(screen.getByText(/Generate Reports/i)).toBeInTheDocument();
    expect(screen.getByText(/View Audit Logs/i)).toBeInTheDocument();
    expect(screen.getByText(/Manage Roles/i)).toBeInTheDocument();
    expect(screen.getByText(/Session Manager/i)).toBeInTheDocument();
  });

  it('calls custom onRegisterTeacher handler when provided', () => {
    const onRegisterTeacher = vi.fn().mockReturnValue(true); // Return truthy to prevent navigate

    render(
      <MemoryRouter>
        <QuickActionPanel onRegisterTeacher={onRegisterTeacher} />
      </MemoryRouter>
    );

    const button = screen.getByText(/Register New Teacher/i).closest('button');
    fireEvent.click(button!);

    expect(onRegisterTeacher).toHaveBeenCalledTimes(1);
    // Since handler returns truthy, navigate should not be called (due to || short-circuit)
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates to default route when no custom handler provided', () => {
    render(
      <MemoryRouter>
        <QuickActionPanel />
      </MemoryRouter>
    );

    const button = screen.getByText(/Register New Teacher/i).closest('button');
    fireEvent.click(button!);

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/admin/users');
  });

  it('calls custom onRegisterStudent handler when provided', () => {
    const onRegisterStudent = vi.fn();

    render(
      <MemoryRouter>
        <QuickActionPanel onRegisterStudent={onRegisterStudent} />
      </MemoryRouter>
    );

    const button = screen.getByText(/Register New Student/i).closest('button');
    fireEvent.click(button!);

    expect(onRegisterStudent).toHaveBeenCalledTimes(1);
  });

  it('calls custom onCreateClass handler when provided', () => {
    const onCreateClass = vi.fn();

    render(
      <MemoryRouter>
        <QuickActionPanel onCreateClass={onCreateClass} />
      </MemoryRouter>
    );

    const button = screen.getByText(/Create Class/i).closest('button');
    fireEvent.click(button!);

    expect(onCreateClass).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    const { container } = render(
      <MemoryRouter>
        <QuickActionPanel className="custom-class" />
      </MemoryRouter>
    );

    const panel = container.querySelector('.custom-class');
    expect(panel).toBeInTheDocument();
  });

  it('renders with responsive grid layout', () => {
    const { container } = render(
      <MemoryRouter>
        <QuickActionPanel />
      </MemoryRouter>
    );

    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('sm:grid-cols-2', 'lg:grid-cols-4');
  });
});
