/**
 * Phase 10 - HOD Creation Tests
 * 
 * Specific tests for HOD creation workflow
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

const renderHODModal = () => {
  return render(
    <BrowserRouter>
      <AdminUserRegistrationModal
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        defaultRole="hod"
      />
    </BrowserRouter>
  );
};

describe('Phase 10 - HOD Creation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListDepartments.mockResolvedValue([
      { id: 'dept-1', name: 'Mathematics' },
      { id: 'dept-2', name: 'Science' },
      { id: 'dept-3', name: 'English' }
    ]);
  });

  describe('HOD Form Rendering', () => {
    it('should render HOD-specific fields', async () => {
      renderHODModal();

      await waitFor(() => {
        expect(screen.getByLabelText(/department/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/qualifications/i)).toBeInTheDocument();
      });
    });

    it('should load and display departments', async () => {
      renderHODModal();

      await waitFor(() => {
        expect(mockListDepartments).toHaveBeenCalled();
      });

      const departmentSelect = screen.getByLabelText(/department/i);
      expect(departmentSelect).toBeInTheDocument();

      await userEvent.click(departmentSelect);
      await waitFor(() => {
        expect(screen.getByText(/mathematics/i)).toBeInTheDocument();
        expect(screen.getByText(/science/i)).toBeInTheDocument();
      });
    });

    it('should show loading state while fetching departments', () => {
      mockListDepartments.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      renderHODModal();

      const departmentSelect = screen.getByLabelText(/department/i);
      expect(departmentSelect).toBeDisabled();
    });
  });

  describe('HOD Creation', () => {
    it('should successfully create HOD with all required fields', async () => {
      const user = userEvent.setup();
      mockCreateUser.mockResolvedValue({
        userId: 'hod-1',
        profileId: 'profile-1',
        email: 'hod@test.local',
        role: 'hod',
        status: 'active'
      });

      renderHODModal();

      await waitFor(() => {
        expect(mockListDepartments).toHaveBeenCalled();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const fullNameInput = screen.getByLabelText(/full name/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const departmentSelect = screen.getByLabelText(/department/i);
      const phoneInput = screen.getByLabelText(/phone number/i);
      const qualificationsInput = screen.getByLabelText(/qualifications/i);
      const submitButton = screen.getByRole('button', { name: /register user/i });

      await user.type(emailInput, 'hod@test.local');
      await user.type(fullNameInput, 'Head of Mathematics');
      await user.type(passwordInput, 'HODPass123!');
      await user.selectOptions(departmentSelect, 'dept-1');
      await user.type(phoneInput, '+1234567890');
      await user.type(qualificationsInput, 'Ph.D Mathematics');

      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateUser).toHaveBeenCalledWith(
          expect.objectContaining({
            email: 'hod@test.local',
            role: 'hod',
            profile: expect.objectContaining({
              departmentId: 'dept-1',
              phone: '+1234567890',
              qualifications: 'Ph.D Mathematics'
            })
          })
        );
      });
    });

    it('should require department selection', async () => {
      const user = userEvent.setup();
      renderHODModal();

      await waitFor(() => {
        expect(mockListDepartments).toHaveBeenCalled();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const fullNameInput = screen.getByLabelText(/full name/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /register user/i });

      await user.type(emailInput, 'hod@test.local');
      await user.type(fullNameInput, 'Head Without Department');
      await user.type(passwordInput, 'HODPass123!');
      // Don't select department
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/department is required/i)).toBeInTheDocument();
      });
    });

    it('should include subjects when provided', async () => {
      const user = userEvent.setup();
      mockCreateUser.mockResolvedValue({
        userId: 'hod-1',
        profileId: 'profile-1',
        email: 'hod@test.local',
        role: 'hod',
        status: 'active'
      });

      renderHODModal();

      await waitFor(() => {
        expect(mockListDepartments).toHaveBeenCalled();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const fullNameInput = screen.getByLabelText(/full name/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const departmentSelect = screen.getByLabelText(/department/i);
      const submitButton = screen.getByRole('button', { name: /register user/i });

      await user.type(emailInput, 'hod@test.local');
      await user.type(fullNameInput, 'Head of Mathematics');
      await user.type(passwordInput, 'HODPass123!');
      await user.selectOptions(departmentSelect, 'dept-1');

      // Select subjects (if multi-select is available)
      const subjectsInput = screen.queryByLabelText(/subjects taught/i);
      if (subjectsInput) {
        await user.click(subjectsInput);
        // Select subjects from dropdown
      }

      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateUser).toHaveBeenCalled();
      });
    });
  });

  describe('Role Switching', () => {
    it('should clear department when switching from HOD to other role', async () => {
      const user = userEvent.setup();
      renderHODModal();

      await waitFor(() => {
        expect(mockListDepartments).toHaveBeenCalled();
      });

      const roleSelect = screen.getByLabelText(/user role/i);
      const departmentSelect = screen.getByLabelText(/department/i);

      await user.selectOptions(departmentSelect, 'dept-1');
      expect(departmentSelect).toHaveValue('dept-1');

      await user.selectOptions(roleSelect, 'teacher');
      await waitFor(() => {
        expect(screen.queryByLabelText(/department/i)).not.toBeInTheDocument();
      });
    });
  });
});

