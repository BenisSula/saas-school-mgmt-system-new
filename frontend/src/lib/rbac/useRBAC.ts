/**
 * Comprehensive RBAC hook
 * Combines role and permission checking
 */
import { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { Role, Permission } from '../../config/permissions';
import {
  hasAnyPermission,
  hasAllPermissions,
  canAccessResource,
  canAccessWithPermission
} from './permissions';
import { hasPermission as baseHasPermission } from '../../config/permissions';

export interface UseRBACOptions {
  requiredRole?: Role;
  requiredPermission?: Permission;
  requiredPermissions?: Permission[];
  requireAll?: boolean; // If true, requires ALL permissions; if false, requires ANY
}

export interface UseRBACReturn {
  // User info
  user: ReturnType<typeof useAuth>['user'];
  role: Role | null;
  isAuthenticated: boolean;

  // Role checks
  hasRole: (role: Role) => boolean;
  hasAnyRole: (roles: Role[]) => boolean;

  // Permission checks
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;

  // Combined checks
  canAccess: (options: UseRBACOptions) => boolean;

  // Quick checks
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  isHOD: boolean;
  isStudent: boolean;
}

/**
 * Comprehensive RBAC hook for role and permission checking
 * @param _options - Optional RBAC options (currently unused, reserved for future use)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useRBAC(_options?: UseRBACOptions): UseRBACReturn {
  const { user, isAuthenticated } = useAuth();

  const role = useMemo(() => (user?.role as Role) || null, [user?.role]);

  const hasRole = useMemo(() => (checkRole: Role) => role === checkRole, [role]);

  const hasAnyRole = useMemo(
    () => (roles: Role[]) => role !== null && roles.includes(role),
    [role]
  );

  const hasPermissionCheck = useMemo(
    () => (permission: Permission) => {
      if (!role) return false;
      return baseHasPermission(role, permission);
    },
    [role]
  );

  const hasAnyPermissionCheck = useMemo(
    () => (permissions: Permission[]) => {
      if (!role) return false;
      return hasAnyPermission(role, permissions);
    },
    [role]
  );

  const hasAllPermissionsCheck = useMemo(
    () => (permissions: Permission[]) => {
      if (!role) return false;
      return hasAllPermissions(role, permissions);
    },
    [role]
  );

  const canAccess = useMemo(
    () => (accessOptions: UseRBACOptions) => {
      if (!isAuthenticated || !role) return false;

      // Check role requirement
      if (accessOptions.requiredRole && !canAccessResource(role, accessOptions.requiredRole)) {
        return false;
      }

      // Check single permission
      if (
        accessOptions.requiredPermission &&
        !canAccessWithPermission(role, accessOptions.requiredPermission)
      ) {
        return false;
      }

      // Check multiple permissions
      if (accessOptions.requiredPermissions) {
        if (accessOptions.requireAll) {
          if (!hasAllPermissions(role, accessOptions.requiredPermissions)) {
            return false;
          }
        } else {
          if (!hasAnyPermission(role, accessOptions.requiredPermissions)) {
            return false;
          }
        }
      }

      return true;
    },
    [isAuthenticated, role]
  );

  // Quick role checks
  const isSuperAdmin = useMemo(() => role === 'superadmin', [role]);
  const isAdmin = useMemo(() => role === 'admin', [role]);
  const isTeacher = useMemo(() => role === 'teacher', [role]);
  // HODs have role='teacher' with additional_roles containing 'hod'
  // Use helper function to check HOD status
  const isHOD = useMemo(() => {
    if (!user || role !== 'teacher') return false;
    // Check if user has 'hod' in additional_roles
    return user.additional_roles?.some((r) => r.role === 'hod') ?? false;
  }, [user, role]);
  const isStudent = useMemo(() => role === 'student', [role]);

  return {
    user,
    role,
    isAuthenticated,
    hasRole,
    hasAnyRole,
    hasPermission: hasPermissionCheck,
    hasAnyPermission: hasAnyPermissionCheck,
    hasAllPermissions: hasAllPermissionsCheck,
    canAccess,
    isSuperAdmin,
    isAdmin,
    isTeacher,
    isHOD,
    isStudent
  };
}
