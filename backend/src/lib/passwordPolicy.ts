/**
 * Password policy enforcement
 * Ensures passwords meet security requirements
 */

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxLength: number;
  commonPasswords: string[];
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  maxLength: 128,
  commonPasswords: [
    'password',
    '12345678',
    'password123',
    'admin123',
    'qwerty123',
    'letmein',
    'welcome123',
    'monkey123',
    '1234567890',
    'password1'
  ]
};

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
}

/**
 * Validates password against policy
 */
export function validatePassword(
  password: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY
): PasswordValidationResult {
  const errors: string[] = [];

  // Check length
  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters long`);
  }
  if (password.length > policy.maxLength) {
    errors.push(`Password must be no more than ${policy.maxLength} characters long`);
  }

  // Check character requirements
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (policy.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check against common passwords
  const lowerPassword = password.toLowerCase();
  if (policy.commonPasswords.some((common) => lowerPassword.includes(common.toLowerCase()))) {
    errors.push('Password is too common. Please choose a more unique password');
  }

  // Calculate strength
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (errors.length === 0) {
    const hasMultipleTypes =
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    const isLongEnough = password.length >= 12;

    if (hasMultipleTypes && isLongEnough) {
      strength = 'strong';
    } else if (hasMultipleTypes || isLongEnough) {
      strength = 'medium';
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength
  };
}

/**
 * Checks if password requires first-time reset
 * This can be based on various factors like:
 * - Admin-created accounts
 * - Password age
 * - Security policy changes
 */
export function requiresFirstTimeReset(
  userCreatedAt: Date,
  passwordChangedAt: Date | null,
  isAdminCreated: boolean
): boolean {
  // Admin-created accounts should reset on first login
  if (isAdminCreated && !passwordChangedAt) {
    return true;
  }

  // If password was never changed since account creation
  if (!passwordChangedAt) {
    const daysSinceCreation = (Date.now() - userCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
    // Require reset if account is older than 7 days and password never changed
    if (daysSinceCreation > 7) {
      return true;
    }
  }

  return false;
}

