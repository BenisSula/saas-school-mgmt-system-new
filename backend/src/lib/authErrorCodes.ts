/**
 * Standardized authentication error codes
 * Used across auth service and routes for consistent error handling
 */

export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_PENDING = 'ACCOUNT_PENDING',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  ACCOUNT_REJECTED = 'ACCOUNT_REJECTED',
  EMAIL_UNVERIFIED = 'EMAIL_UNVERIFIED',
  MISSING_REQUIRED_FIELDS = 'MISSING_REQUIRED_FIELDS',
  DUPLICATE_EMAIL = 'DUPLICATE_EMAIL',
  TENANT_NOT_FOUND = 'TENANT_NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  PASSWORD_POLICY_VIOLATION = 'PASSWORD_POLICY_VIOLATION',
  FIRST_LOGIN_REQUIRED = 'FIRST_LOGIN_REQUIRED',
  REFRESH_TOKEN_INVALID = 'REFRESH_TOKEN_INVALID',
  REFRESH_TOKEN_EXPIRED = 'REFRESH_TOKEN_EXPIRED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: AuthErrorCode,
    public readonly field?: string,
    public readonly statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

