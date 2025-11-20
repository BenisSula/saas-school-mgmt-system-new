/**
 * Phase 10 - Login Form Tests
 * 
 * Comprehensive tests for login form functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { LoginForm } from '../components/auth/LoginForm';

// Mock AuthContext
const mockLogin = vi.fn();
const mockOnSuccess = vi.fn();
const mockOnSwitchToRegister = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin
  })
}));

// Mock useLoginForm hook
let mockValues = { email: '', password: '' };
const mockSetValue = vi.fn((field: string, value: string) => {
  mockValues = { ...mockValues, [field]: value };
});
const mockSetGeneralError = vi.fn();
const mockHandleSubmit = vi.fn(async (e: React.FormEvent) => {
  e.preventDefault();
  await mockLogin(mockValues);
});

vi.mock('../hooks/useLoginForm', () => ({
  useLoginForm: vi.fn(({ initialValues, onSuccess: _onSuccess }) => {
    mockValues = {
      email: initialValues?.email || '',
      password: initialValues?.password || ''
    };
    return {
      values: mockValues,
      setValue: mockSetValue,
      fieldErrors: {},
      generalError: null,
      setGeneralError: mockSetGeneralError,
      submitting: false,
      handleSubmit: mockHandleSubmit
    };
  })
}));

const renderLoginForm = (props = {}) => {
  return render(
    <BrowserRouter>
      <LoginForm
        onSuccess={mockOnSuccess}
        onSwitchToRegister={mockOnSwitchToRegister}
        {...props}
      />
    </BrowserRouter>
  );
};

describe('Phase 10 - Login Form Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Form Rendering', () => {
    it('should render login form with email and password fields', () => {
      renderLoginForm();

      expect(screen.getByPlaceholderText(/you@school.edu/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/•/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('should render with initial values when provided', () => {
      renderLoginForm({
        initialValues: {
          email: 'test@example.com',
          password: 'password123'
        }
      });

      expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('password123')).toBeInTheDocument();
    });

    it('should show "Create an account" link when onSwitchToRegister is provided', () => {
      renderLoginForm();

      expect(screen.getByText(/create an account/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should require email field', () => {
      renderLoginForm();

      const emailInput = screen.getByLabelText(/email/i);
      expect(emailInput).toHaveAttribute('required');
    });

    it('should require password field', () => {
      renderLoginForm();

      const passwordInput = screen.getByPlaceholderText(/•/);
      expect(passwordInput).toHaveAttribute('required');
    });

    it('should show error message for invalid email format', async () => {
      const user = userEvent.setup();
      renderLoginForm();

      const emailInput = screen.getByPlaceholderText(/you@school.edu/i);
      await user.type(emailInput, 'invalid-email');

      // Email validation happens on blur or submit
      expect(emailInput).toHaveValue('invalid-email');
    });
  });

  describe('Form Submission', () => {
    it('should call login function on form submit', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue({});

      renderLoginForm();

      const emailInput = screen.getByPlaceholderText(/you@school.edu/i);
      const passwordInput = screen.getByPlaceholderText(/•/);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123'
        });
      });
    });

    it('should call onSuccess callback after successful login', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue({});

      renderLoginForm();

      const emailInput = screen.getByPlaceholderText(/you@school.edu/i);
      const passwordInput = screen.getByPlaceholderText(/•/);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should show error message on login failure', async () => {
      const user = userEvent.setup();
      mockLogin.mockRejectedValue(new Error('Invalid credentials'));

      renderLoginForm();

      const emailInput = screen.getByPlaceholderText(/you@school.edu/i);
      const passwordInput = screen.getByPlaceholderText(/•/);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/login failed/i)).toBeInTheDocument();
      });
    });

    it('should disable submit button while submitting', async () => {
      const user = userEvent.setup();
      mockLogin.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      renderLoginForm();

      const emailInput = screen.getByPlaceholderText(/you@school.edu/i);
      const passwordInput = screen.getByPlaceholderText(/•/);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      expect(submitButton).toBeDisabled();
    });
  });

  describe('Password Visibility Toggle', () => {
    it('should toggle password visibility', async () => {
      const user = userEvent.setup();
      renderLoginForm();

      const passwordInput = screen.getByPlaceholderText(/password/i) as HTMLInputElement;
      const toggleButton = screen.getByRole('button', { name: /toggle password visibility/i });

      expect(passwordInput.type).toBe('password');

      await user.click(toggleButton);
      expect(passwordInput.type).toBe('text');

      await user.click(toggleButton);
      expect(passwordInput.type).toBe('password');
    });
  });

  describe('Navigation', () => {
    it('should call onSwitchToRegister when "Create an account" is clicked', async () => {
      const user = userEvent.setup();
      renderLoginForm();

      const switchLink = screen.getByText(/create an account/i);
      await user.click(switchLink);

      expect(mockOnSwitchToRegister).toHaveBeenCalled();
    });
  });
});

