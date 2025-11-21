import type { TenantUser } from '../api';

/**
 * Check if a user is an HOD (Head of Department)
 * HODs have role='teacher' and additional_roles containing 'hod'
 */
export function isHOD(user: TenantUser): boolean {
  return user.role === 'teacher' && hasAdditionalRole(user, 'hod');
}

/**
 * Get all additional roles for a user
 */
export function getUserAdditionalRoles(user: TenantUser): Array<string> {
  return user.additional_roles?.map((r) => r.role) || [];
}

/**
 * Check if a user has a specific additional role
 */
export function hasAdditionalRole(user: TenantUser, role: string): boolean {
  return user.additional_roles?.some((r) => r.role === role) ?? false;
}

