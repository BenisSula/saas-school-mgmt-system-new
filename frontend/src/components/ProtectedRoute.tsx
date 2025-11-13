import React from 'react';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../lib/api';

export interface ProtectedRouteProps {
  allowedRoles?: Role[];
  fallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
  children: React.ReactNode;
}

export function ProtectedRoute({
  allowedRoles,
  fallback,
  loadingFallback,
  children
}: ProtectedRouteProps) {
  const { isLoading, user } = useAuth();

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

  if ((user.status ?? 'active') !== 'active') {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-6 text-sm text-amber-200">
        Your account is pending admin approval. Please contact your administrator for access.
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-6 text-sm text-amber-200">
        You do not have permission to view this page. Switch to an appropriate role.
      </div>
    );
  }

  return <>{children}</>;
}

export default ProtectedRoute;
