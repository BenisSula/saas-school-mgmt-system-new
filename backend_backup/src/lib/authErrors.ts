/**
 * Custom authentication error classes with error codes
 * These provide machine-readable error codes for frontend mapping
 */

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthError);
    }
  }
}

/**
 * Invalid credentials error (401)
 */
export class InvalidCredentialsError extends AuthError {
  constructor(message: string = 'Invalid email or password') {
    super(message, 'INVALID_CREDENTIALS', 401);
    this.name = 'InvalidCredentialsError';
  }
}

/**
 * Account pending approval error (403)
 */
export class AccountPendingError extends AuthError {
  constructor(message: string = 'Account pending approval by admin') {
    super(message, 'ACCOUNT_PENDING', 403);
    this.name = 'AccountPendingError';
  }
}

/**
 * Account suspended error (403)
 */
export class AccountSuspendedError extends AuthError {
  constructor(message: string = 'Account suspended') {
    super(message, 'ACCOUNT_SUSPENDED', 403);
    this.name = 'AccountSuspendedError';
  }
}

/**
 * Email not verified error (403)
 */
export class EmailUnverifiedError extends AuthError {
  constructor(message: string = 'Please verify your email') {
    super(message, 'EMAIL_UNVERIFIED', 403);
    this.name = 'EmailUnverifiedError';
  }
}

/**
 * Tenant bootstrapping in progress (202)
 */
export class TenantBootstrappingError extends AuthError {
  constructor(message: string = 'Tenant creating. Check back shortly.') {
    super(message, 'TENANT_BOOTSTRAPPING', 202);
    this.name = 'TenantBootstrappingError';
  }
}

