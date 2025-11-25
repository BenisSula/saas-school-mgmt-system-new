/**
 * Security Rules for Write Operations
 * All write operations must be protected with permission checks
 */

import type { Permission } from '../../config/permissions';

/**
 * Permission groups for write operations
 * These should be checked on both frontend and backend
 */
export const WRITE_PERMISSIONS: Record<string, Permission[]> = {
  // User management
  'users:create': ['users:manage'],
  'users:update': ['users:manage'],
  'users:delete': ['users:manage'],
  'users:invite': ['users:invite'],

  // Student management
  'students:create': ['students:manage'],
  'students:update': ['students:manage'],
  'students:delete': ['students:manage'],

  // Teacher management
  'teachers:create': ['teachers:manage'],
  'teachers:update': ['teachers:manage'],
  'teachers:delete': ['teachers:manage'],

  // Attendance
  'attendance:mark': ['attendance:mark'],
  'attendance:update': ['attendance:manage'],
  'attendance:delete': ['attendance:manage'],

  // Grades
  'grades:enter': ['grades:enter'],
  'grades:update': ['grades:edit'],
  'grades:delete': ['grades:manage'],

  // Exams
  'exams:create': ['exams:manage'],
  'exams:update': ['exams:manage'],
  'exams:delete': ['exams:manage'],

  // Fees
  'fees:create': ['fees:manage'],
  'fees:update': ['fees:manage'],
  'fees:delete': ['fees:manage'],

  // Settings
  'settings:update': ['settings:branding', 'settings:terms', 'settings:classes'],

  // Tenants (SuperAdmin only)
  'tenants:create': ['tenants:manage'],
  'tenants:update': ['tenants:manage'],
  'tenants:delete': ['tenants:manage'],

  // Messages
  'messages:send': ['messages:send']
};

/**
 * Check if a permission allows a write operation
 */
export function canPerformWriteOperation(
  userPermissions: Permission[],
  operation: string
): boolean {
  const requiredPermissions = WRITE_PERMISSIONS[operation];
  if (!requiredPermissions || requiredPermissions.length === 0) {
    // If no permission requirement defined, deny by default (secure by default)
    return false;
  }

  // User must have at least one of the required permissions
  return requiredPermissions.some((perm) => userPermissions.includes(perm));
}

/**
 * Security rule: Never trust frontend input
 * All data must be validated and sanitized on the backend
 */
export const SECURITY_RULES = {
  /**
   * Always validate input on the backend
   * Frontend validation is for UX only, not security
   */
  VALIDATE_ON_BACKEND: true,

  /**
   * Always sanitize user input
   * Prevent XSS, SQL injection, etc.
   */
  SANITIZE_INPUT: true,

  /**
   * Always check permissions on the backend
   * Frontend checks are for UX only
   */
  CHECK_PERMISSIONS_ON_BACKEND: true,

  /**
   * Use HTTPS in production
   */
  REQUIRE_HTTPS_IN_PRODUCTION: true,

  /**
   * Rate limit write operations
   */
  RATE_LIMIT_WRITES: true,

  /**
   * Log all write operations for audit
   */
  AUDIT_WRITES: true
} as const;
