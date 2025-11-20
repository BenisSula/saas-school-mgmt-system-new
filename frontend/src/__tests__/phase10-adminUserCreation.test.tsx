/**
 * Phase 10 - Admin User Creation Tests
 * 
 * Tests for admin user creation modal and workflow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AdminUserRegistrationModal } from '../components/admin/AdminUserRegistrationModal';

// Mock API
const mockCreateUser = vi.fn();
const mockListDepartments = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    listDepartments: mockListDepartments
  }
}));

vi.mock('../lib/api/userApi', () => ({
  userApi: {
    createUser: mockCreateUser
  }
}));

const mockOnClose = vi.fn();
const mockOnSuccess = vi.fn();

const renderAdminModal = (props = {}) => {
  return render(
    <BrowserRouter>
      <AdminUserRegistrationModal
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        defaultRole="student"
        {...props}
      />
    </BrowserRouter>
  );
};

describe('Phase 10 - Admin User Creation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListDepartments.mockResolvedValue([
      { id: 'dept-1', name: 'Mathematics' },
      { id: 'dept-2', name: 'Science' }
    ]);
  });

  describe('Modal Rendering', () => {
    it('should render admin user registration modal', () => {
      renderAdminModal();

      expect(screen.getByText(/register new user/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/user role/i)).toBeInTheDocument();
    });

    it('should show role selection dropdown', () => {
      renderAdminModal();

      const roleSelect = screen.getByLabelText(/user role/i);
      expect(roleSelect).toBeInTheDocument();
    });

    it('should show student fields by default', () => {
      renderAdminModal({ defaultRole: 'student' });

      expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/student id/i)).toBeInTheDocument();
    });

    it('should show teacher fields when teacher role is selected', async () => {
      const user = userEvent.setup();
      renderAdminModal();

      const roleSelect = screen.getByLabelText(/user role/i);
      await user.selectOptions(roleSelect, 'teacher');

      await waitFor(() => {
        expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/qualifications/i)).toBeInTheDocument();
      });
    });

    it('should show HOD fields when HOD role is selected', async () => {
      const user = userEvent.setup();
      renderAdminModal();

      const roleSelect = screen.getByLabelText(/user role/i);
      await user.selectOptions(roleSelect, 'hod');

      await waitFor(() => {
        expect(screen.getByLabelText(/department/i)).toBeInTheDocument();
      });
    });
  });

  describe('User Creation', () => {
    it('should successfully create student user', async () => {
      const user = userEvent.setup();
      mockCreateUser.mockResolvedValue({
        userId: 'user-1',
        profileId: 'profile-1',
        email: 'student@test.local',
        role: 'student',
        status: 'active'
      });

      renderAdminModal({ defaultRole: 'student' });

      const emailInput = screen.getByLabelText(/email/i);
      const fullNameInput = screen.getByLabelText(/full name/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /register user/i });

      await user.type(emailInput, 'student@test.local');
      await user.type(fullNameInput, 'John Student');
      await user.type(passwordInput, 'Password123!');

      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateUser).toHaveBeenCalled();
      });
    });

    it('should successfully create teacher user', async () => {
      const user = userEvent.setup();
      mockCreateUser.mockResolvedValue({
        userId: 'user-2',
        profileId: 'profile-2',
        email: 'teacher@test.local',
        role: 'teacher',
        status: 'active'
      });

      renderAdminModal({ defaultRole: 'teacher' });

      const emailInput = screen.getByLabelText(/email/i);
      const fullNameInput = screen.getByLabelText(/full name/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const roleSelect = screen.getByLabelText(/user role/i);
      const submitButton = screen.getByRole('button', { name: /register user/i });

      await user.selectOptions(roleSelect, 'teacher');
      await user.type(emailInput, 'teacher@test.local');
      await user.type(fullNameInput, 'Jane Teacher');
      await user.type(passwordInput, 'Password123!');

      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateUser).toHaveBeenCalled();
      });
    });

    it('should successfully create HOD user with department', async () => {
      const user = userEvent.setup();
      mockCreateUser.mockResolvedValue({
        userId: 'user-3',
        profileId: 'profile-3',
        email: 'hod@test.local',
        role: 'hod',
        status: 'active'
      });

      renderAdminModal({ defaultRole: 'hod' });

      await waitFor(() => {
        expect(mockListDepartments).toHaveBeenCalled();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const fullNameInput = screen.getByLabelText(/full name/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const departmentSelect = screen.getByLabelText(/department/i);
      const submitButton = screen.getByRole('button', { name: /register user/i });

      await user.type(emailInput, 'hod@test.local');
      await user.type(fullNameInput, 'Head of Department');
      await user.type(passwordInput, 'Password123!');
      await user.selectOptions(departmentSelect, 'dept-1');

      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateUser).toHaveBeenCalledWith(
          expect.objectContaining({
            role: 'hod',
            profile: expect.objectContaining({
              departmentId: 'dept-1'
            })
          })
        );
      });
    });

    it('should show credential modal after successful creation', async () => {
      const user = userEvent.setup();
      mockCreateUser.mockResolvedValue({
        userId: 'user-1',
        profileId: 'profile-1',
        email: 'student@test.local',
        role: 'student',
        status: 'active'
      });

      renderAdminModal();

      const emailInput = screen.getByLabelText(/email/i);
      const fullNameInput = screen.getByLabelText(/full name/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /register user/i });

      await user.type(emailInput, 'student@test.local');
      await user.type(fullNameInput, 'John Student');
      await user.type(passwordInput, 'Password123!');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/credentials/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('should require email field', () => {
      renderAdminModal();

      const emailInput = screen.getByLabelText(/email/i);
      expect(emailInput).toHaveAttribute('required');
    });

    it('should require password field', () => {
      renderAdminModal();

      const passwordInput = screen.getByLabelText(/password/i);
      expect(passwordInput).toHaveAttribute('required');
    });

    it('should require department for HOD role', async () => {
      renderAdminModal({ defaultRole: 'hod' });

      await waitFor(() => {
        const departmentSelect = screen.getByLabelText(/department/i);
        expect(departmentSelect).toHaveAttribute('required');
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error message on creation failure', async () => {
      const user = userEvent.setup();
      mockCreateUser.mockRejectedValue(new Error('Creation failed'));

      renderAdminModal();

      const emailInput = screen.getByLabelText(/email/i);
      const fullNameInput = screen.getByLabelText(/full name/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /register user/i });

      await user.type(emailInput, 'student@test.local');
      await user.type(fullNameInput, 'John Student');
      await user.type(passwordInput, 'Password123!');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to register/i)).toBeInTheDocument();
      });
    });
  });
});

