import React from 'react';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../lib/api';
import type { Permission } from '../hooks/usePermission';
import { rolePermissions } from '../config/permissions';

export interface ProtectedRouteProps {
  allowedRoles?: Role[];
  allowedPermissions?: Permission[];
  requireAllPermissions?: boolean; // If true, requires ALL permissions; if false, requires ANY permission
  fallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
  children: React.ReactNode;
}

export function ProtectedRoute({
  allowedRoles,
  allowedPermissions,
  requireAllPermissions = false,
  fallback,
  loadingFallback,
  children
}: ProtectedRouteProps) {
  const { isLoading, user } = useAuth();

  // Calculate required permissions based on user role and permission list
  const hasRequiredPermissions = React.useMemo(() => {
    if (!allowedPermissions || allowedPermissions.length === 0) {
      return true; // No permission requirements
    }

    if (!user || !user.role) {
      return false;
    }

    const role = user.role as Role;
    const userPermissions = rolePermissions[role] ?? [];

    if (requireAllPermissions) {
      // User must have ALL specified permissions
      return allowedPermissions.every((perm) => userPermissions.includes(perm));
    } else {
      // User must have ANY of the specified permissions
      return allowedPermissions.some((perm) => userPermissions.includes(perm));
    }
  }, [allowedPermissions, requireAllPermissions, user]);

  if (isLoading) {
    return (
      loadingFallback ?? (
        <div className="flex min-h-[200px] items-center justify-center text-sm text-[var(--brand-muted)]">
          Checking permissions…
        </div>
      )
    );
  }

  if (!user) {
    return (
      fallback ?? (
        <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 text-center text-sm text-[var(--brand-muted)]">
          Please sign in to view this page.
        </div>
      )
    );
  }

  if (user.status !== 'active') {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-6 text-sm text-amber-200">
        Your account is pending admin approval. Please contact your administrator for access.
      </div>
    );
  }

  // Check role-based access first
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-6 text-sm text-amber-200">
        You do not have permission to view this page. Switch to an appropriate role.
      </div>
    );
  }

  // Check permission-based access (only if roles check passed or no roles specified)
  // If both roles and permissions are specified, user must pass both checks
  if (allowedPermissions && !hasRequiredPermissions) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-6 text-sm text-amber-200">
        You do not have permission to view this page. Required permissions:{' '}
        {allowedPermissions.join(', ')}
      </div>
    );
  }

  return <>{children}</>;
}

export default ProtectedRoute;
