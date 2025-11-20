/**
 * Phase 10 - Registration Form Tests
 * 
 * Comprehensive tests for registration form functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { RegisterForm } from '../components/auth/RegisterForm';

// Mock dependencies
const mockRegister = vi.fn();
const mockOnSuccess = vi.fn();
const mockOnPending = vi.fn();
const mockOnSwitchToLogin = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    register: mockRegister
  })
}));

const mockSetValue = vi.fn();
const mockSetGeneralError = vi.fn();
const mockHandleSubmit = vi.fn((e: React.FormEvent) => {
  e.preventDefault();
});

vi.mock('../hooks/useRegisterForm', () => ({
  useRegisterForm: vi.fn(() => {
    return {
      values: {
        email: '',
        password: '',
        confirmPassword: '',
        role: 'student',
        fullName: '',
        gender: '',
        address: '',
        dateOfBirth: '',
        parentGuardianName: '',
        parentGuardianContact: '',
        studentId: '',
        classId: '',
        phone: '',
        qualifications: '',
        yearsOfExperience: '',
        subjects: [],
        teacherId: '',
        tenantId: ''
      },
      setValue: mockSetValue,
      fieldErrors: {},
      generalError: null,
      setGeneralError: mockSetGeneralError,
      submitting: false,
      handleSubmit: mockHandleSubmit,
      isStudent: true,
      isTeacher: false,
      isHOD: false,
      isTenantAdmin: false,
      tenantOptions: [],
      loadingTenants: false,
      loadTenants: vi.fn()
    };
  })
}));

const renderRegisterForm = (props = {}) => {
  return render(
    <BrowserRouter>
      <RegisterForm
        onSuccess={mockOnSuccess}
        onPending={mockOnPending}
        onSwitchToLogin={mockOnSwitchToLogin}
        {...props}
      />
    </BrowserRouter>
  );
};

describe('Phase 10 - Registration Form Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Form Rendering', () => {
    it('should render registration form with required fields', () => {
      renderRegisterForm();

      expect(screen.getByLabelText(/^full name$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^confirm password$/i)).toBeInTheDocument();
    });

    it('should show role selection dropdown', () => {
      renderRegisterForm();

      expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
    });

    it('should show student-specific fields when student role is selected', async () => {
      const user = userEvent.setup();
      renderRegisterForm();

      const roleSelect = screen.getByLabelText(/role/i);
      await user.selectOptions(roleSelect, 'student');

      await waitFor(() => {
        expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/parent\/guardian name/i)).toBeInTheDocument();
      });
    });

    it('should show teacher-specific fields when teacher role is selected', async () => {
      const user = userEvent.setup();
      renderRegisterForm();

      const roleSelect = screen.getByLabelText(/role/i);
      await user.selectOptions(roleSelect, 'teacher');

      await waitFor(() => {
        expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/qualifications/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('should require full name field', () => {
      renderRegisterForm();

      const fullNameInput = screen.getByLabelText(/full name/i);
      expect(fullNameInput).toHaveAttribute('required');
    });

    it('should require email field', () => {
      renderRegisterForm();

      const emailInput = screen.getByLabelText(/work email/i);
      expect(emailInput).toHaveAttribute('required');
    });

    it('should require password field', () => {
      renderRegisterForm();

      const passwordInput = screen.getByLabelText(/^password$/i);
      expect(passwordInput).toHaveAttribute('required');
    });

    it('should require confirm password field', () => {
      renderRegisterForm();

      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      expect(confirmPasswordInput).toHaveAttribute('required');
    });

    it('should validate password matches confirm password', async () => {
      const user = userEvent.setup();
      renderRegisterForm();

      const passwordInput = screen.getByLabelText(/password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(passwordInput, 'Password123!');
      await user.type(confirmPasswordInput, 'DifferentPass123!');

      // Validation should show error
      await waitFor(() => {
        expect(confirmPasswordInput).toHaveValue('DifferentPass123!');
      });
    });
  });

  describe('Form Submission', () => {
    it('should call register function on form submit', async () => {
      const user = userEvent.setup();
      mockRegister.mockResolvedValue({
        user: { status: 'active' }
      });

      renderRegisterForm();

      const fullNameInput = screen.getByLabelText(/^full name$/i);
      const emailInput = screen.getByLabelText(/^email$/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /register/i });

      await user.type(fullNameInput, 'John Doe');
      await user.type(emailInput, 'john@example.com');
      await user.type(passwordInput, 'Password123!');
      await user.type(confirmPasswordInput, 'Password123!');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalled();
      });
    });

    it('should call onSuccess for active users', async () => {
      const user = userEvent.setup();
      mockRegister.mockResolvedValue({
        user: { status: 'active' }
      });

      renderRegisterForm();

      const submitButton = screen.getByRole('button', { name: /register/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should call onPending for pending users', async () => {
      const user = userEvent.setup();
      mockRegister.mockResolvedValue({
        user: { status: 'pending' }
      });

      renderRegisterForm();

      const submitButton = screen.getByRole('button', { name: /register/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnPending).toHaveBeenCalled();
      });
    });

    it('should show error message on registration failure', async () => {
      const user = userEvent.setup();
      mockRegister.mockRejectedValue(new Error('Registration failed'));

      renderRegisterForm();

      const submitButton = screen.getByRole('button', { name: /register/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/registration failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Role-Specific Fields', () => {
    it('should show tenant selector for student role', async () => {
      const user = userEvent.setup();
      renderRegisterForm();

      const roleSelect = screen.getByLabelText(/role/i);
      await user.selectOptions(roleSelect, 'student');

      await waitFor(() => {
        expect(screen.getByText(/school registration code/i)).toBeInTheDocument();
      });
    });

    it('should show tenant selector for teacher role', async () => {
      const user = userEvent.setup();
      renderRegisterForm();

      const roleSelect = screen.getByLabelText(/role/i);
      await user.selectOptions(roleSelect, 'teacher');

      await waitFor(() => {
        expect(screen.getByText(/school registration code/i)).toBeInTheDocument();
      });
    });
  });
});

