import { useState, useCallback } from 'react';
import type React from 'react';
import { toast } from 'sonner';
import { mapApiErrorToFieldErrors, isCriticalError } from '../lib/errorMapper';
import type { ApiErrorResponse } from '../lib/api';

export interface UseAuthFormOptions<T extends Record<string, unknown>> {
  initialValues?: Partial<T>;
  onSubmit: (values: T) => Promise<unknown>;
  onSuccess?: (result: unknown) => void;
  validate?: (values: T) => Record<string, string> | null;
}

export interface UseAuthFormReturn<T extends Record<string, unknown>> {
  values: T;
  setValue: (field: keyof T, value: unknown) => void;
  setValues: (values: Partial<T>) => void;
  fieldErrors: Record<string, string>;
  setFieldError: (field: string, error: string | undefined) => void;
  clearFieldError: (field: string) => void;
  clearAllErrors: () => void;
  generalError: string | null;
  setGeneralError: (error: string | null) => void;
  submitting: boolean;
  handleSubmit: (event: React.FormEvent) => Promise<void>;
  reset: () => void;
}

/**
 * Base hook for authentication forms
 * Provides common form state management, validation, and error handling
 */
export function useAuthForm<T extends Record<string, unknown>>(
  options: UseAuthFormOptions<T>
): UseAuthFormReturn<T> {
  const { initialValues = {}, onSubmit, onSuccess, validate } = options;

  const [values, setValuesState] = useState<T>(initialValues as T);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setValue = useCallback(
    (field: keyof T, value: unknown) => {
      setValuesState((prev) => ({ ...prev, [field]: value }));
      // Clear field error when user starts typing
      if (fieldErrors[field as string]) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next[field as string];
          return next;
        });
      }
    },
    [fieldErrors]
  );

  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState((prev) => ({ ...prev, ...newValues }));
  }, []);

  const setFieldError = useCallback((field: string, error: string | undefined) => {
    setFieldErrors((prev) => {
      if (error === undefined) {
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return { ...prev, [field]: error };
    });
  }, []);

  const clearFieldError = useCallback(
    (field: string) => {
      setFieldError(field, undefined);
    },
    [setFieldError]
  );

  const clearAllErrors = useCallback(() => {
    setFieldErrors({});
    setGeneralError(null);
  }, []);

  const reset = useCallback(() => {
    setValuesState(initialValues as T);
    clearAllErrors();
    setSubmitting(false);
  }, [initialValues, clearAllErrors]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent): Promise<void> => {
      event.preventDefault();
      if (submitting) return;

      // Clear previous errors
      clearAllErrors();

      // Run validation if provided
      if (validate) {
        const validationErrors = validate(values);
        if (validationErrors) {
          setFieldErrors(validationErrors);
          return;
        }
      }

      setSubmitting(true);

      try {
        const result = await onSubmit(values);
        if (onSuccess) {
          onSuccess(result);
        }
      } catch (err) {
        console.error('[useAuthForm] Submit error:', err);

        // Map API errors to field errors
        if (err instanceof Error) {
          const errorWithApi = err as Error & { apiError?: ApiErrorResponse };
          const apiFieldErrors = mapApiErrorToFieldErrors(errorWithApi);

          // Set field-level errors
          if (Object.keys(apiFieldErrors).length > 0) {
            setFieldErrors(apiFieldErrors);
          }

          // Show toast for critical errors
          if (isCriticalError(errorWithApi)) {
            toast.error(err.message || 'An error occurred. Please try again.');
          }

          // Set general error message
          setGeneralError(err.message || 'An error occurred. Please try again.');
        } else {
          const message = typeof err === 'string' ? err : 'An error occurred. Please try again.';
          setGeneralError(message);
          toast.error(message);
        }
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [values, submitting, validate, onSubmit, onSuccess, clearAllErrors]
  );

  return {
    values,
    setValue,
    setValues,
    fieldErrors,
    setFieldError,
    clearFieldError,
    clearAllErrors,
    generalError,
    setGeneralError,
    submitting,
    handleSubmit,
    reset
  };
}
