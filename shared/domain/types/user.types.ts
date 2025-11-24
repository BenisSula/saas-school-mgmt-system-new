/**
 * User Domain Types
 * 
 * Types related to the User domain, shared between frontend and backend.
 */

export type UserRole = 'student' | 'teacher' | 'hod' | 'admin' | 'superadmin';

export interface TenantUser {
  id: string;
  email: string;
  role: UserRole;
  isVerified: boolean;
  status: string | null;
  createdAt: string;
  additionalRoles?: Array<{
    role: string;
    grantedAt?: string;
    grantedBy?: string;
    metadata?: Record<string, unknown>;
  }>;
  pendingProfileData?: Record<string, unknown> | null;
}

export interface UserInput {
  email: string;
  password?: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  tenantId?: string;
}

export interface UserFilters {
  status?: string;
  role?: string;
  search?: string;
}

