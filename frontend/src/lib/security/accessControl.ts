/**
 * Access control utilities for frontend
 */

import type { Role } from '../../lib/api';

/**
 * Check if user has required role
 */
export function hasRole(userRole: Role | undefined, requiredRoles: Role[]): boolean {
  if (!userRole) return false;
  return requiredRoles.includes(userRole);
}

/**
 * Check if user is admin or superadmin
 */
export function isAdmin(userRole: Role | undefined): boolean {
  return userRole === 'admin' || userRole === 'superadmin';
}

/**
 * Check if user can access admin features
 */
export function canAccessAdmin(userRole: Role | undefined): boolean {
  return isAdmin(userRole);
}

/**
 * Check if user can access superuser features
 */
export function canAccessSuperuser(userRole: Role | undefined): boolean {
  return userRole === 'superadmin';
}

/**
 * Check if user can manage users
 */
export function canManageUsers(userRole: Role | undefined): boolean {
  return isAdmin(userRole);
}

/**
 * Check if user can view their own data
 */
export function canViewSelf(userId: string | undefined, targetUserId: string | undefined): boolean {
  return userId === targetUserId;
}

/**
 * Guard function to prevent unauthorized access
 */
export function requireRole(userRole: Role | undefined, requiredRoles: Role[]): void {
  if (!hasRole(userRole, requiredRoles)) {
    throw new Error('Unauthorized: Insufficient permissions');
  }
}

