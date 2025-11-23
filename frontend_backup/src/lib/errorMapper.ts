import type { ApiErrorResponse } from './api';

/**
 * Maps API error responses to field-level errors
 * Returns an object with field names as keys and error messages as values
 */
const duplicateEmailCodes = new Set(['DUPLICATE_EMAIL', 'EMAIL_EXISTS']);

export function mapApiErrorToFieldErrors(
  error: Error & { apiError?: ApiErrorResponse }
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  if (error.apiError) {
    const apiError = error.apiError;
    const normalizedCode = apiError.code ? apiError.code.toUpperCase() : undefined;

    // If error has a specific field, map it directly
    if (apiError.field) {
      fieldErrors[apiError.field] = apiError.message;
    } else {
      // Try to infer field from error code or message
      const message = apiError.message.toLowerCase();

      if (
        message.includes('email') ||
        (normalizedCode && duplicateEmailCodes.has(normalizedCode))
      ) {
        fieldErrors.email = apiError.message;
      } else if (message.includes('password') || normalizedCode === 'INVALID_CREDENTIALS') {
        fieldErrors.password = apiError.message;
      } else if (message.includes('role')) {
        fieldErrors.role = apiError.message;
      } else if (message.includes('tenant')) {
        fieldErrors.tenantId = apiError.message;
      }
    }
  }

  return fieldErrors;
}

/**
 * Determines if an error is a critical error that should show a toast
 * Critical errors are: 500, network errors, or errors without field mapping
 */
export function isCriticalError(error: Error & { apiError?: ApiErrorResponse }): boolean {
  if (!error.apiError) {
    return true; // Unknown errors are critical
  }

  const code = error.apiError.code;

  // Critical error codes
  const criticalCodes = ['INTERNAL_ERROR', 'NETWORK_ERROR', 'UNAUTHORIZED'];

  if (code && criticalCodes.includes(code)) {
    return true;
  }

  // If error doesn't map to a specific field, it's likely critical
  const fieldErrors = mapApiErrorToFieldErrors(error);
  return Object.keys(fieldErrors).length === 0;
}
