import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { sanitizeText } from '../lib/sanitize';
import { useAuthForm } from './useAuthForm';

export interface UseLoginFormOptions {
  initialValues?: {
    email?: string;
    password?: string;
  };
  onSuccess?: () => void;
}

export interface LoginFormValues extends Record<string, unknown> {
  email: string;
  password: string;
}

/**
 * Hook for login form logic
 * Handles email/password validation and submission
 */
export function useLoginForm(options: UseLoginFormOptions = {}) {
  const { login } = useAuth();
  const { initialValues = {} } = options;

  const trimmedEmail = useMemo(
    () => sanitizeText(initialValues.email || '').toLowerCase(),
    [initialValues.email]
  );

  const validate = useMemo(
    () =>
      (values: LoginFormValues): Record<string, string> | null => {
        const errors: Record<string, string> = {};
        const email = sanitizeText(values.email || '').toLowerCase();

        if (!email) {
          errors.email = 'Please enter your email address.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.email = 'Please enter a valid email address.';
        }

        if (!values.password) {
          errors.password = 'Please enter your password.';
        }

        return Object.keys(errors).length > 0 ? errors : null;
      },
    []
  );

  const handleSubmit = async (values: LoginFormValues) => {
    const email = sanitizeText(values.email).toLowerCase();
    return await login({ email, password: values.password });
  };

  const form = useAuthForm<LoginFormValues>({
    initialValues: {
      email: initialValues.email || '',
      password: initialValues.password || '',
    },
    onSubmit: handleSubmit,
    onSuccess: options.onSuccess,
    validate,
  });

  return {
    ...form,
    trimmedEmail,
  };
}
