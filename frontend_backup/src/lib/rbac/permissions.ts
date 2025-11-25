/**
 * RBAC Permissions Configuration
 * Centralized permission definitions matching backend
 * Re-exports from config/permissions and adds utility functions
 */
import type { Role, Permission } from '../../config/permissions';
import { rolePermissions, hasPermission as baseHasPermission } from '../../config/permissions';

/**
 * Re-export hasPermission from config to avoid duplication
 */
export { baseHasPermission as hasPermission };

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: Role): Permission[] {
  return rolePermissions[role] ?? [];
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  const rolePerms = getRolePermissions(role);
  return permissions.some((perm) => rolePerms.includes(perm));
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  const rolePerms = getRolePermissions(role);
  return permissions.every((perm) => rolePerms.includes(perm));
}

/**
 * Check if user can access resource (role-based)
 */
export function canAccessResource(userRole: Role, requiredRole?: Role): boolean {
  if (!requiredRole) return true;
  return userRole === requiredRole;
}

/**
 * Check if user can access resource (permission-based)
 */
export function canAccessWithPermission(userRole: Role, requiredPermission: Permission): boolean {
  return baseHasPermission(userRole, requiredPermission);
}
