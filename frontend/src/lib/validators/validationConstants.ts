/**
 * Shared validation constants
 * Consolidates duplicate validation patterns across the codebase
 */

/**
 * Email regex pattern
 * Matches standard email format: user@domain.com
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Phone number regex pattern
 * Allows international format with optional + prefix
 */
export const PHONE_REGEX = /^\+?[\d\s-()]+$/;

/**
 * Date format regex (YYYY-MM-DD)
 */
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Password strength requirements
 */
export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true
} as const;

/**
 * Password regex patterns
 */
export const PASSWORD_PATTERNS = {
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  number: /[0-9]/,
  specialChar: /[^A-Za-z0-9]/
} as const;

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Validate phone number format
 */
export function isValidPhone(phone: string): boolean {
  return PHONE_REGEX.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

/**
 * Validate date format (YYYY-MM-DD)
 */
export function isValidDateFormat(date: string): boolean {
  return DATE_REGEX.test(date);
}

