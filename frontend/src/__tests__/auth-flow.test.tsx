import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RegisterForm } from '../components/auth/RegisterForm';
import AdminRoleManagementPage from '../pages/AdminRoleManagementPage';
import * as AuthContextModule from '../context/AuthContext';
import { api } from '../lib/api';
import { toast } from 'sonner';

// Create separate mock functions for this test file (similar to loginRegister.integration.test.tsx)
// Use hoisted mocks to ensure they're available before the mock factory runs
const { mockLogin, mockRegister } = vi.hoisted(() => ({
  mockLogin: vi.fn(),
  mockRegister: vi.fn()
}));

// Override the AuthContext mock from vitest.setup.ts for this test file
// This gives us direct access to the mock functions
vi.mock('../context/AuthContext', () => {
  const mockAuthState = {
    user: {
      id: 'test-user',
      email: 'test@example.com',
      role: 'admin',
      tenantId: 'tenant_alpha',
      isVerified: true,
      status: 'active' as const
    },
    isAuthenticated: true,
    isLoading: false,
    login: mockLogin,
    register: mockRegister,
    logout: vi.fn()
  };
  return {
    AuthProvider: ({ children }: { children: React.ReactNode }) => children,
    useAuth: () => mockAuthState,
    __mockAuthState: mockAuthState
  };
});

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

// Use the mock from the module
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
      updateUserRole: vi.fn(),
      listSchools: vi.fn(),
      lookupTenant: vi.fn()
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
    (api.listSchools as unknown as Mock).mockReset();
    (api.lookupTenant as unknown as Mock).mockReset();
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

    // Setup mock to resolve with pending response
    // Setup mocks
    mockRegister.mockResolvedValueOnce(pendingResponse);
    mockLogin.mockReset();
    mockRegister.mockClear();

    // Verify mock is set up correctly
    expect(vi.isMockFunction(mockRegister)).toBe(true);
    console.log('Mock register setup verified:', {
      isMockFunction: vi.isMockFunction(mockRegister),
      mockCalls: mockRegister.mock.calls.length,
      mockResults: mockRegister.mock.results.length
    });

    // Also add console.log to see if handleSubmit from useRegisterForm is being called
    // We can't easily spy on it, but we can check if register is accessed

    // Mock API for tenant selection
    (api.listSchools as unknown as Mock).mockResolvedValue({
      schools: [
        { id: 'tenant_alpha', name: 'Test School', domain: null, registrationCode: 'TEST123' }
      ],
      count: 1,
      total: 1,
      type: 'recent' as const
    });
    (api.lookupTenant as unknown as Mock).mockResolvedValue({
      id: 'tenant_alpha',
      name: 'Test School',
      domain: null,
      registrationCode: 'TEST123'
    });

    const user = userEvent.setup();

    // Use RegisterForm directly with teacher role and defaultTenantId
    // Use a valid UUID format for tenantId (validation requires UUID format)
    const validTenantId = '550e8400-e29b-41d4-a716-446655440000'; // Valid UUID format
    render(
      <MemoryRouter>
        <RegisterForm
          defaultRole="teacher"
          defaultTenantId={validTenantId}
          onPending={() => {
            // This will be called and trigger toast.info
            toast.info(
              'Account created and pending admin approval. We will notify you once activated.'
            );
          }}
        />
      </MemoryRouter>
    );

    // Wait for form to be ready - teacher fields should be visible immediately with defaultRole="teacher"
    // TenantSelector may or may not call listSchools when defaultTenantId is provided
    await waitFor(
      () => {
        expect(screen.getByLabelText(/Full name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // CRITICAL: Ensure subjects field is initialized as an empty array in form state
    // The form's initial values might not include subjects, so we need to ensure it's set
    // Actually, let's check if the form initializes subjects correctly by looking at the multiselect
    const subjectsFieldInitial = screen.getByLabelText(/subject\(s\) taught/i);
    const initialSubjectsText = subjectsFieldInitial.textContent || '';
    console.log('Initial subjects field state:', {
      text: initialSubjectsText,
      isPlaceholder: initialSubjectsText.toLowerCase().includes('select')
    });

    // Fill form fields - teacher fields should already be visible with defaultRole="teacher"
    await user.type(screen.getByLabelText(/Full name/i), 'Jane Doe');
    await user.type(screen.getByLabelText(/Work email/i), 'Teacher@Example.COM');
    await user.type(screen.getByPlaceholderText(/Create a secure password/i), 'StrongPass123!');
    await user.type(screen.getByPlaceholderText(/re-enter your password/i), 'StrongPass123!');
    await user.selectOptions(screen.getByLabelText(/gender/i), 'female');

    // Fill required teacher fields
    const phoneField = await screen.findByLabelText(/phone number/i, {}, { timeout: 3000 });
    await user.type(phoneField, '+1234567890');

    const qualificationsField = await screen.findByLabelText(
      /qualifications/i,
      {},
      { timeout: 3000 }
    );
    await user.type(qualificationsField, 'B.Ed');

    const experienceField = await screen.findByLabelText(
      /years of experience/i,
      {},
      { timeout: 3000 }
    );
    // Clear first, then type the number (form should convert string to number)
    await user.clear(experienceField);
    await user.type(experienceField, '5');

    // Verify the value was set
    await waitFor(
      () => {
        const field = screen.getByLabelText(/years of experience/i) as HTMLInputElement;
        expect(field.value).toBe('5');
      },
      { timeout: 1000 }
    );

    // Select at least one subject (required field) - AuthMultiSelect uses button with dropdown
    // Use the exact same approach as the working test
    const subjectsButton = await screen.findByLabelText(
      /subject\(s\) taught/i,
      {},
      { timeout: 3000 }
    );
    await user.click(subjectsButton);

    // Wait for dropdown to open and select Mathematics - exact match to working test
    await waitFor(
      async () => {
        const mathOption = screen.queryByText(/mathematics/i);
        if (mathOption) {
          // Click the button containing Mathematics (it's a button with checkbox inside)
          const mathButton = mathOption.closest('button');
          if (mathButton) {
            await user.click(mathButton);
            return true;
          }
        }
        return false;
      },
      { timeout: 3000 }
    );

    // Wait for selection to be reflected - the multiselect should show Mathematics
    await waitFor(
      () => {
        const multiselectButton = screen.getByLabelText(/subject\(s\) taught/i);
        const buttonText = multiselectButton.textContent || '';
        return buttonText.toLowerCase().includes('mathematics');
      },
      { timeout: 3000 }
    );

    // Give form state time to update after subject selection
    await new Promise((resolve) => setTimeout(resolve, 500));

    await user.type(screen.getByLabelText(/address/i), '123 Main St');

    // Final check: ensure all required fields are properly filled
    await waitFor(
      () => {
        // Check for any visible validation errors
        const errorAlerts = screen.queryAllByRole('alert');
        const hasErrors = errorAlerts.some((alert) => {
          const text = alert.textContent?.toLowerCase() || '';
          return text.includes('required') || text.includes('error') || text.includes('invalid');
        });
        expect(hasErrors).toBe(false);
      },
      { timeout: 2000 }
    );

    // Verify all required fields are filled before submitting
    await waitFor(
      () => {
        const fullName = screen.getByLabelText(/Full name/i) as HTMLInputElement;
        const email = screen.getByLabelText(/Work email/i) as HTMLInputElement;
        const password = screen.getByPlaceholderText(
          /Create a secure password/i
        ) as HTMLInputElement;
        const address = screen.getByLabelText(/address/i) as HTMLInputElement;

        expect(fullName.value).toBeTruthy();
        expect(email.value).toBeTruthy();
        expect(password.value).toBeTruthy();
        expect(address.value).toBeTruthy();
      },
      { timeout: 2000 }
    );

    // Wait for form to be ready before submitting
    const submitButton = await screen.findByRole(
      'button',
      { name: /Create account/i },
      { timeout: 5000 }
    );
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).not.toBeDisabled();

    // Ensure submit button is enabled
    expect(submitButton).not.toBeDisabled();

    // Before submitting, double-check all required fields are filled
    const fullNameValue = (screen.getByLabelText(/Full name/i) as HTMLInputElement).value;
    const emailValue = (screen.getByLabelText(/Work email/i) as HTMLInputElement).value;
    const passwordValue = (
      screen.getByPlaceholderText(/Create a secure password/i) as HTMLInputElement
    ).value;
    const phoneValue = (screen.getByLabelText(/phone number/i) as HTMLInputElement).value;
    const qualificationsValue = (screen.getByLabelText(/qualifications/i) as HTMLInputElement)
      .value;
    const experienceValue = (screen.getByLabelText(/years of experience/i) as HTMLInputElement)
      .value;
    const addressValue = (screen.getByLabelText(/address/i) as HTMLInputElement).value;
    const subjectsButtonElement = screen.getByLabelText(/subject\(s\) taught/i);
    const subjectsText = subjectsButtonElement.textContent || '';

    // Verify all required fields have values
    expect(fullNameValue).toBeTruthy();
    expect(emailValue).toBeTruthy();
    expect(passwordValue).toBeTruthy();
    expect(phoneValue).toBeTruthy();
    expect(qualificationsValue).toBeTruthy();
    expect(experienceValue).toBeTruthy();
    expect(addressValue.length).toBeGreaterThanOrEqual(10); // Address must be at least 10 chars
    expect(subjectsText.toLowerCase()).toContain('mathematics'); // Subject must be selected

    // Spy on the form's onSubmit to see if it's being called
    const formElement = document.querySelector('form');
    let formSubmitCalled = false;
    if (formElement) {
      formElement.addEventListener(
        'submit',
        () => {
          formSubmitCalled = true;
        },
        { once: true }
      );
    }

    // Before clicking submit, log the form values to debug validation
    const subjectsButtonEl = screen.getByLabelText(/subject\(s\) taught/i);
    const subjectsDisplayText = subjectsButtonEl.textContent || '';
    const hasMathematics = subjectsDisplayText.toLowerCase().includes('mathematics');

    const passwordInput = screen.getByPlaceholderText(
      /Create a secure password/i
    ) as HTMLInputElement;
    const confirmPasswordInput = screen.getByPlaceholderText(
      /re-enter your password/i
    ) as HTMLInputElement;

    const formValuesBeforeSubmit = {
      fullName: (screen.getByLabelText(/Full name/i) as HTMLInputElement).value,
      email: (screen.getByLabelText(/Work email/i) as HTMLInputElement).value,
      password: passwordInput.value,
      confirmPassword: confirmPasswordInput.value,
      gender: (screen.getByLabelText(/gender/i) as HTMLSelectElement).value,
      phone: (screen.getByLabelText(/phone number/i) as HTMLInputElement).value,
      qualifications: (screen.getByLabelText(/qualifications/i) as HTMLInputElement).value,
      yearsOfExperience: (screen.getByLabelText(/years of experience/i) as HTMLInputElement).value,
      address: (screen.getByLabelText(/address/i) as HTMLInputElement).value,
      subjectsText: subjectsDisplayText,
      hasMathematics: hasMathematics,
      defaultTenantId: validTenantId
    };
    console.log('Form values before submit:', formValuesBeforeSubmit);

    // Verify critical fields
    expect(formValuesBeforeSubmit.fullName).toBeTruthy();
    expect(formValuesBeforeSubmit.email).toBeTruthy();
    expect(formValuesBeforeSubmit.password).toBeTruthy();
    expect(formValuesBeforeSubmit.phone).toBeTruthy();
    expect(formValuesBeforeSubmit.qualifications).toBeTruthy();
    expect(formValuesBeforeSubmit.yearsOfExperience).toBeTruthy();
    expect(formValuesBeforeSubmit.address.length).toBeGreaterThanOrEqual(10);
    expect(hasMathematics).toBe(true); // Subject must be selected

    // CRITICAL: Verify passwords match (validation requires this)
    expect(formValuesBeforeSubmit.password).toBe(formValuesBeforeSubmit.confirmPassword);
    console.log('Password match check:', {
      password: formValuesBeforeSubmit.password,
      confirmPassword: formValuesBeforeSubmit.confirmPassword,
      match: formValuesBeforeSubmit.password === formValuesBeforeSubmit.confirmPassword
    });

    // CRITICAL: Verify subject is selected - this is required for validation
    // The subjects field must have at least one subject selected
    const subjectsButtonBeforeSubmit = screen.getByLabelText(/subject\(s\) taught/i);
    const subjectsTextBeforeSubmit = subjectsButtonBeforeSubmit.textContent || '';
    const hasSubjectSelected =
      subjectsTextBeforeSubmit.toLowerCase().includes('mathematics') ||
      subjectsTextBeforeSubmit.toLowerCase().includes('math');
    console.log('Subject selection check before submit:', {
      subjectsText: subjectsTextBeforeSubmit,
      hasSubjectSelected: hasSubjectSelected,
      buttonTextLength: subjectsTextBeforeSubmit.length,
      isPlaceholder: subjectsTextBeforeSubmit.toLowerCase().includes('select subjects')
    });

    // If subject is not selected, try selecting it again
    if (!hasSubjectSelected || subjectsTextBeforeSubmit.toLowerCase().includes('select subjects')) {
      console.warn('Subject not properly selected, attempting to select again...');
      await user.click(subjectsButtonBeforeSubmit);
      await waitFor(
        async () => {
          const mathOption = screen.queryByText(/mathematics/i);
          if (mathOption) {
            const mathButton = mathOption.closest('button');
            if (mathButton) {
              await user.click(mathButton);
              await new Promise((resolve) => setTimeout(resolve, 200));
              return true;
            }
          }
          return false;
        },
        { timeout: 3000 }
      );

      // Verify again after re-selection
      const subjectsButtonAfter = screen.getByLabelText(/subject\(s\) taught/i);
      const subjectsTextAfter = subjectsButtonAfter.textContent || '';
      const hasSubjectAfter = subjectsTextAfter.toLowerCase().includes('mathematics');
      expect(hasSubjectAfter).toBe(true);
      console.log('Subject re-selected:', subjectsTextAfter);
    }

    // Before submitting, let's try to inspect the form's internal state
    // by checking if we can access the form element's data or by triggering validation manually
    // Actually, let's just submit and then check what validation errors were set

    // Before submitting, let's try to manually trigger validation to see what it returns
    // We can't directly access the form's internal validation function, but we can
    // check if there are any obvious issues with the form state

    // Before clicking submit, ensure form is fully ready
    // Wait a bit more to ensure all state updates have propagated
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Click submit button
    await user.click(submitButton);

    // Wait for form to process the submission and validation
    // Give enough time for validation to run, errors to be set, or register to be called
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // After submit, check if any field errors were set
    // Field errors are set via setFieldErrors in useAuthForm when validation fails
    // They should appear as elements with role="alert" or aria-invalid="true"
    const allFields = document.querySelectorAll('input, select, textarea, [role="combobox"]');
    const fieldsWithErrorsAfterSubmit = Array.from(allFields).filter((field) => {
      const ariaInvalid = field.getAttribute('aria-invalid');
      const hasErrorId = field.getAttribute('aria-describedby')?.includes('error');
      return ariaInvalid === 'true' || hasErrorId;
    });

    if (fieldsWithErrorsAfterSubmit.length > 0) {
      console.log(
        'Fields with errors after submit:',
        fieldsWithErrorsAfterSubmit.map((f) => {
          const errorId = f
            .getAttribute('aria-describedby')
            ?.split(' ')
            .find((id) => id.includes('error'));
          const errorElement = errorId ? document.getElementById(errorId) : null;
          return {
            name: f.getAttribute('name') || f.getAttribute('id'),
            error: errorElement?.textContent
          };
        })
      );
    }

    // Also check for error messages in the DOM
    const errorMessagesAfterSubmit = screen
      .queryAllByRole('alert')
      .map((el) => el.textContent)
      .filter(Boolean);

    if (errorMessagesAfterSubmit.length > 0) {
      console.log('Error messages found after submit:', errorMessagesAfterSubmit);
    }

    // Check if form submit event was fired
    console.log('Form submit event fired:', formSubmitCalled);

    // Check if submitting state changed (would indicate handleSubmit started)
    await waitFor(
      () => {
        // After clicking submit, the button should show loading state if handleSubmit was called
        const submitBtnAfter = screen.queryByRole('button', { name: /Create account/i });
        const isLoading = submitBtnAfter?.querySelector('[class*="animate-spin"]') !== null;
        console.log('Submit button loading state:', isLoading);
      },
      { timeout: 2000 }
    ).catch(() => {
      console.log('Could not check loading state');
    });

    // Check for field errors that might have been set by validation
    // Look for error elements with role="alert" or aria-invalid="true"
    const errorElements = screen.queryAllByRole('alert');
    const invalidFields = document.querySelectorAll('[aria-invalid="true"]');

    if (errorElements.length > 0 || invalidFields.length > 0) {
      const errorTexts = errorElements.map((el) => el.textContent).filter(Boolean);
      const invalidFieldNames = Array.from(invalidFields).map(
        (field) => field.getAttribute('name') || field.getAttribute('id') || 'unknown'
      );
      console.log('Validation errors detected:', {
        errorMessages: errorTexts,
        invalidFields: invalidFieldNames
      });
    }

    // Check for validation errors that might prevent submission
    // Check multiple ways errors might be displayed
    const errorAlerts = screen.queryAllByRole('alert');
    const fieldErrors = screen.queryAllByText(/required|invalid|error|please|must|cannot/i);
    const allErrorElements = screen.queryAllByText(/error/i);
    const allTextContent = document.body.textContent || '';

    // Look for error patterns in the DOM
    const errorPatterns = [/required/i, /invalid/i, /error/i, /must/i, /cannot/i, /please/i];

    const foundErrors: string[] = [];
    errorPatterns.forEach((pattern) => {
      const matches = allTextContent.match(new RegExp(pattern.source + '[^.]{0,100}', 'gi'));
      if (matches) {
        foundErrors.push(...matches);
      }
    });

    if (errorAlerts.length > 0 || fieldErrors.length > 0 || foundErrors.length > 0) {
      const errorMessages = [
        ...errorAlerts.map((e) => e.textContent),
        ...fieldErrors.map((e) => e.textContent),
        ...foundErrors
      ].filter(Boolean);

      // Log all found errors with details
      console.warn('Validation errors found:', errorMessages);
      console.warn('Error alerts count:', errorAlerts.length);
      console.warn('Field errors count:', fieldErrors.length);
      console.warn('All error elements count:', allErrorElements.length);

      // Log details of each error element
      fieldErrors.forEach((err, idx) => {
        console.warn(`Field error ${idx}:`, {
          text: err.textContent,
          id: err.id,
          className: err.className,
          parent: err.parentElement?.tagName
        });
      });
    }

    // Wait for registration to be called
    // The form will validate, then call handleSubmit which calls register
    // Check if register was called - if not, there might be a validation error or other issue

    // Add a small delay to allow form processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check if register was called immediately (might have happened synchronously)
    const immediateCallCount = mockRegister.mock.calls.length;
    console.log('Register call count after submit:', immediateCallCount);

    // If register wasn't called, validation likely failed or something else is wrong
    if (immediateCallCount === 0) {
      // Check if subjects field has an error
      const subjectsField = screen.queryByLabelText(/subject\(s\) taught/i);
      if (subjectsField) {
        const subjectsAriaInvalid = subjectsField.getAttribute('aria-invalid');
        const subjectsError = subjectsField.getAttribute('aria-describedby');
        const errorElement = subjectsError ? document.getElementById(subjectsError) : null;
        console.log('Subjects field state:', {
          ariaInvalid: subjectsAriaInvalid,
          hasError: !!errorElement,
          errorText: errorElement?.textContent,
          buttonText: subjectsField.textContent
        });
      }

      // Check if submit button is disabled (would indicate form is in submitting state or has errors)
      const submitBtnAfter = screen.queryByRole('button', { name: /Create account/i });
      const isDisabled =
        submitBtnAfter?.hasAttribute('disabled') ||
        submitBtnAfter?.getAttribute('aria-disabled') === 'true' ||
        submitBtnAfter?.classList.contains('opacity-50') ||
        submitBtnAfter?.classList.contains('cursor-not-allowed');
      console.log('Submit button state after click:', {
        disabled: isDisabled,
        hasLoadingSpinner: submitBtnAfter?.querySelector('[class*="animate-spin"]') !== null,
        className: submitBtnAfter?.className
      });

      // Since register wasn't called and no errors are shown,
      // validation might be failing silently or handleSubmit is returning early for another reason
      console.log('Debug: Form submission did not trigger register. Possible causes:');
      console.log('  1. Validation is failing silently');
      console.log('  2. handleSubmit is returning early (check if submitting is already true)');
      console.log('  3. Mock register function is not being used by useAuth()');
    }

    try {
      await waitFor(
        () => {
          expect(mockRegister).toHaveBeenCalled();
        },
        { timeout: 15000 }
      );
    } catch (error) {
      // If register wasn't called, check for any errors or validation issues
      const allErrors = screen.queryAllByRole('alert');
      const allErrorTexts = screen.queryAllByText(/error|invalid|required|please/i);
      const errorMessages = [
        ...allErrors.map((e) => e.textContent),
        ...allErrorTexts.map((e) => e.textContent)
      ].filter(Boolean);

      // Check if submit button is disabled (would indicate form is submitting or has errors)
      const submitBtnAfterClick = screen.queryByRole('button', { name: /Create account/i });
      const isDisabled =
        submitBtnAfterClick?.hasAttribute('disabled') ||
        submitBtnAfterClick?.getAttribute('aria-disabled') === 'true';

      // Log debugging info
      console.error('Register was not called. Debug info:', {
        errorMessages,
        submitButtonDisabled: isDisabled,
        registerCallCount: mockRegister.mock.calls.length,
        mockRegisterSetup: typeof mockRegister,
        isMockFunction: vi.isMockFunction(mockRegister),
        formSubmitEventFired: formSubmitCalled
      });

      // Check if form submission handler is even being called
      // by checking if submitting state changed
      const formElement = screen.queryByRole('form') || document.querySelector('form');
      if (formElement) {
        console.error('Form element found:', {
          hasOnSubmit: !!formElement.onsubmit,
          action: formElement.getAttribute('action'),
          method: formElement.getAttribute('method')
        });
      }

      throw error;
    }
    expect(mockAuthState.register).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'teacher@example.com',
        password: 'StrongPass123!',
        role: 'teacher',
        tenantId: 'tenant_alpha'
      })
    );

    // Wait for toast.info to be called - RegisterPage's handlePending calls it
    // The toast is called via onPending callback which is triggered when status is pending
    await waitFor(
      () => {
        expect(toast.info).toHaveBeenCalledWith(
          'Account created and pending admin approval. We will notify you once activated.'
        );
      },
      { timeout: 10000 }
    );
  }, 25000);

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
    // The actual toast message includes more details
    expect(toast.success).toHaveBeenCalledWith(
      'pending@example.com approved. Profile record created.',
      expect.objectContaining({
        description: 'You can now edit the profile to assign classes or make corrections.'
      })
    );
  });
});
