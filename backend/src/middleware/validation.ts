import { Role } from '../config/permissions';

/**
 * Allowed roles for registration
 */
export const ALLOWED_ROLES: Role[] = ['student', 'teacher', 'admin', 'superadmin', 'hod'];

/**
 * Email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Password strength requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one symbol
 */
/**
 * Validate email format
 */
export function validateEmailFormat(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Validate role is in allowed list
 */
export function validateRole(role: string): role is Role {
  return ALLOWED_ROLES.includes(role as Role);
}

/**
 * Sanitize tenant name:
 * - Trim whitespace
 * - Remove special characters (only allow alphanumeric, spaces, hyphens, underscores)
 * - Limit length
 */
export function sanitizeTenantName(name: string): string {
  if (!name || typeof name !== 'string') {
    throw new Error('Tenant name must be a non-empty string');
  }

  // Trim and remove leading/trailing whitespace
  let sanitized = name.trim();

  if (sanitized.length === 0) {
    throw new Error('Tenant name cannot be empty');
  }

  // Remove special characters - only allow alphanumeric, spaces, hyphens, underscores
  sanitized = sanitized.replace(/[^a-zA-Z0-9\s\-_]/g, '');

  // Remove multiple consecutive spaces
  sanitized = sanitized.replace(/\s+/g, ' ');

  // Limit length to 100 characters
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100).trim();
  }

  if (sanitized.length === 0) {
    throw new Error('Tenant name contains only invalid characters');
  }

  return sanitized;
}

/**
 * Validation error class for structured error handling
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public code: string = 'VALIDATION_ERROR'
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
