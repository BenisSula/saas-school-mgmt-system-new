/**
 * Authentication error code to user-friendly message mapping
 * Maps backend error codes to frontend display messages
 */

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_PENDING'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_REJECTED'
  | 'EMAIL_UNVERIFIED'
  | 'MISSING_REQUIRED_FIELDS'
  | 'DUPLICATE_EMAIL'
  | 'TENANT_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'
  | 'CSRF_TOKEN_MISSING'
  | 'CSRF_TOKEN_MISMATCH'
  | 'RATE_LIMIT_EXCEEDED'
  | 'NETWORK_ERROR'
  | 'SESSION_EXPIRED'
  | 'UNKNOWN_ERROR';

export interface AuthErrorMapping {
  code: AuthErrorCode;
  message: string;
  userAction?: string;
}

/**
 * Maps error codes to user-friendly messages
 */
const ERROR_MAPPINGS: Record<AuthErrorCode, AuthErrorMapping> = {
  INVALID_CREDENTIALS: {
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password. Please check your credentials and try again.',
    userAction: 'Verify your email and password are correct.'
  },
  ACCOUNT_PENDING: {
    code: 'ACCOUNT_PENDING',
    message: 'Your account is pending admin approval. You will be notified once it is activated.',
    userAction: 'Please wait for administrator approval or contact support.'
  },
  ACCOUNT_SUSPENDED: {
    code: 'ACCOUNT_SUSPENDED',
    message: 'Your account has been suspended. Please contact an administrator.',
    userAction: 'Contact your school administrator for assistance.'
  },
  ACCOUNT_REJECTED: {
    code: 'ACCOUNT_REJECTED',
    message: 'Your account registration was rejected. Please contact support for more information.',
    userAction: 'Contact support to resolve this issue.'
  },
  EMAIL_UNVERIFIED: {
    code: 'EMAIL_UNVERIFIED',
    message: 'Please verify your email address before logging in. Check your inbox for a verification link.',
    userAction: 'Click the verification link in your email or request a new verification email.'
  },
  MISSING_REQUIRED_FIELDS: {
    code: 'MISSING_REQUIRED_FIELDS',
    message: 'Please fill in all required fields.',
    userAction: 'Complete all required fields and try again.'
  },
  DUPLICATE_EMAIL: {
    code: 'DUPLICATE_EMAIL',
    message: 'An account with this email already exists. Please use a different email or sign in.',
    userAction: 'Use a different email address or sign in with your existing account.'
  },
  TENANT_NOT_FOUND: {
    code: 'TENANT_NOT_FOUND',
    message: 'School not found. Please check the school code or name and try again.',
    userAction: 'Verify the school registration code or name is correct.'
  },
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    message: 'Please check your input and try again.',
    userAction: 'Review the form fields and correct any errors.'
  },
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred. Please try again later.',
    userAction: 'If the problem persists, contact support.'
  },
  CSRF_TOKEN_MISSING: {
    code: 'CSRF_TOKEN_MISSING',
    message: 'Security token missing. Please refresh the page and try again.',
    userAction: 'Refresh the page and try again.'
  },
  CSRF_TOKEN_MISMATCH: {
    code: 'CSRF_TOKEN_MISMATCH',
    message: 'Security token mismatch. Please refresh the page and try again.',
    userAction: 'Refresh the page and try again.'
  },
  RATE_LIMIT_EXCEEDED: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please wait a moment and try again.',
    userAction: 'Wait a few minutes before trying again.'
  },
  NETWORK_ERROR: {
    code: 'NETWORK_ERROR',
    message: 'Unable to connect to the server. Please check your internet connection.',
    userAction: 'Check your internet connection and try again.'
  },
  SESSION_EXPIRED: {
    code: 'SESSION_EXPIRED',
    message: 'Your session has expired. Please sign in again.',
    userAction: 'Sign in again to continue.'
  },
  UNKNOWN_ERROR: {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred. Please try again.',
    userAction: 'If the problem persists, contact support.'
  }
};

/**
 * Extracts error code from error object or API response
 */
export function extractAuthErrorCode(error: unknown): AuthErrorCode {
  if (error && typeof error === 'object') {
    // Check for API error response format
    if ('apiError' in error && error.apiError && typeof error.apiError === 'object') {
      const apiError = error.apiError as { code?: string };
      if (apiError.code && apiError.code in ERROR_MAPPINGS) {
        return apiError.code as AuthErrorCode;
      }
    }

    // Check for direct code property
    if ('code' in error && typeof error.code === 'string' && error.code in ERROR_MAPPINGS) {
      return error.code as AuthErrorCode;
    }

    // Check error message for known patterns
    if ('message' in error && typeof error.message === 'string') {
      const message = error.message.toLowerCase();
      if (message.includes('invalid credentials') || message.includes('invalid email or password')) {
        return 'INVALID_CREDENTIALS';
      }
      if (message.includes('pending')) {
        return 'ACCOUNT_PENDING';
      }
      if (message.includes('suspended')) {
        return 'ACCOUNT_SUSPENDED';
      }
      if (message.includes('rejected')) {
        return 'ACCOUNT_REJECTED';
      }
      if (message.includes('unverified') || message.includes('verify')) {
        return 'EMAIL_UNVERIFIED';
      }
      if (message.includes('csrf')) {
        return message.includes('missing') ? 'CSRF_TOKEN_MISSING' : 'CSRF_TOKEN_MISMATCH';
      }
      if (message.includes('rate limit') || message.includes('too many')) {
        return 'RATE_LIMIT_EXCEEDED';
      }
      if (message.includes('network') || message.includes('fetch')) {
        return 'NETWORK_ERROR';
      }
      if (message.includes('expired') || message.includes('session')) {
        return 'SESSION_EXPIRED';
      }
    }
  }

  return 'UNKNOWN_ERROR';
}

/**
 * Gets user-friendly error message from error code
 */
export function getAuthErrorMessage(error: unknown): AuthErrorMapping {
  const code = extractAuthErrorCode(error);
  return ERROR_MAPPINGS[code];
}

/**
 * Gets error message string (for backward compatibility)
 */
export function getAuthErrorString(error: unknown): string {
  return getAuthErrorMessage(error).message;
}

