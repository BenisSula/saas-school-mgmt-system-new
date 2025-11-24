import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Role, Permission } from '../config/permissions';
import { hasPermission } from '../config/permissions';
import { isHOD } from '../lib/utils/userHelpers';

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
  children,
}: ProtectedRouteProps) {
  const { isLoading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [hasRedirected, setHasRedirected] = React.useState(false);

  // Define default prompts before hooks (for use in useEffect)
  const defaultSignInPrompt = React.useMemo(
    () => (
      <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 text-center text-sm text-[var(--brand-muted)]">
        Please sign in to view this page.
      </div>
    ),
    []
  );

  const defaultAccessDeniedPrompt = React.useMemo(
    () => (
      <div
        className="rounded-lg border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200"
        role="alert"
        aria-live="assertive"
      >
        You do not have permission to view this page.
      </div>
    ),
    []
  );

  // Get additional roles from user
  const additionalRoles = React.useMemo(() => {
    if (!user?.additional_roles) return [];
    return user.additional_roles.map((r) => r.role);
  }, [user?.additional_roles]);

  // Calculate required permissions based on user role and permission list
  const hasRequiredPermissions = React.useMemo(() => {
    if (!allowedPermissions || allowedPermissions.length === 0) {
      return true; // No permission requirements
    }

    if (!user || !user.role) {
      return false;
    }

    const role = user.role as Role;

    if (requireAllPermissions) {
      // User must have ALL specified permissions
      return allowedPermissions.every((perm) => hasPermission(role, perm, additionalRoles));
    } else {
      // User must have ANY of the specified permissions
      return allowedPermissions.some((perm) => hasPermission(role, perm, additionalRoles));
    }
  }, [allowedPermissions, requireAllPermissions, user, additionalRoles]);

  // Redirect to not-authorized if access denied (only once)
  // Must be called before any conditional returns (React hooks rule)
  React.useEffect(() => {
    if (isLoading || hasRedirected) return;
    if (!user) return;

    if (user.status !== 'active') {
      // Don't redirect for pending status - show inline message
      return;
    }

    // Check role-based access
    // For HOD routes, check if user is HOD (has 'hod' in additional_roles)
    if (allowedRoles) {
      const userIsHOD = isHOD(user);
      const hasAllowedRole =
        allowedRoles.includes(user.role) || (userIsHOD && allowedRoles.includes('teacher'));

      if (!hasAllowedRole) {
        setHasRedirected(true);
        navigate('/not-authorized', {
          replace: true,
          state: { from: location.pathname },
        });
        return;
      }
    }

    // Check permission-based access
    if (allowedPermissions && !hasRequiredPermissions) {
      setHasRedirected(true);
      navigate('/not-authorized', {
        replace: true,
        state: { from: location.pathname },
      });
      return;
    }
  }, [
    isLoading,
    user,
    allowedRoles,
    allowedPermissions,
    hasRequiredPermissions,
    navigate,
    location.pathname,
    hasRedirected,
  ]);

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
    return fallback ?? defaultSignInPrompt;
  }

  if (user.status !== 'active') {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-6 text-sm text-amber-200">
        Your account is pending admin approval. Please contact your administrator for access.
      </div>
    );
  }

  // If redirecting, show loading state
  if (hasRedirected) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-[var(--brand-muted)]">
        Redirecting...
      </div>
    );
  }

  // Check role-based access first
  // For HOD routes, check if user is HOD (has 'hod' in additional_roles)
  if (allowedRoles) {
    const userIsHOD = isHOD(user);
    const hasAllowedRole =
      allowedRoles.includes(user.role) || (userIsHOD && allowedRoles.includes('teacher'));

    if (!hasAllowedRole) {
      // Will be handled by useEffect redirect, but show fallback while redirecting
      return fallback ?? defaultAccessDeniedPrompt;
    }
  }

  // Check permission-based access (only if roles check passed or no roles specified)
  // If both roles and permissions are specified, user must pass both checks
  if (allowedPermissions && !hasRequiredPermissions) {
    // Will be handled by useEffect redirect, but show fallback while redirecting
    return fallback ?? defaultAccessDeniedPrompt;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
