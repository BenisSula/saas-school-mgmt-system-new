import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { hasPermission, type Permission, type Role } from '../config/permissions';

/**
 * Hook to check if the current user has a specific permission
 *
 * @param permission - The permission to check
 * @returns boolean indicating if the user has the permission
 *
 * @example
 * ```tsx
 * const canManageUsers = usePermission('users:manage');
 * if (canManageUsers) {
 *   // Show user management UI
 * }
 * ```
 */
export function usePermission(permission: Permission): boolean {
  const { user } = useAuth();

  return useMemo(() => {
    if (!user || !user.role) {
      return false;
    }

    // Ensure role is valid
    const role = user.role as Role;
    return hasPermission(role, permission);
  }, [user, permission]);
}

/**
 * Hook to check if the current user has any of the specified permissions
 *
 * @param permissions - Array of permissions to check
 * @returns boolean indicating if the user has at least one of the permissions
 */
export function useAnyPermission(permissions: Permission[]): boolean {
  const { user } = useAuth();

  return useMemo(() => {
    if (!user || !user.role || permissions.length === 0) {
      return false;
    }

    const role = user.role as Role;
    return permissions.some((permission) => hasPermission(role, permission));
  }, [user, permissions]);
}

/**
 * Hook to check if the current user has all of the specified permissions
 *
 * @param permissions - Array of permissions to check
 * @returns boolean indicating if the user has all of the permissions
 */
export function useAllPermissions(permissions: Permission[]): boolean {
  const { user } = useAuth();

  return useMemo(() => {
    if (!user || !user.role || permissions.length === 0) {
      return false;
    }

    const role = user.role as Role;
    return permissions.every((permission) => hasPermission(role, permission));
  }, [user, permissions]);
}
