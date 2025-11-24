/**
 * Role Utilities
 * DRY: Centralizes role checking logic, especially for additional roles
 */

import type { PoolClient } from 'pg';

export interface UserWithRoles {
  id: string;
  role: string;
  additional_roles?: Array<{
    role: string;
    granted_at: string;
    granted_by?: string;
    metadata?: Record<string, unknown>;
  }>;
}

/**
 * Check if user has an additional role
 * @param user - User object with additional_roles array
 * @param roleName - Role name to check (e.g., 'hod')
 * @returns true if user has the additional role
 */
export function hasAdditionalRole(
  user: UserWithRoles | null | undefined,
  roleName: string
): boolean {
  if (!user) return false;
  if (!user.additional_roles || !Array.isArray(user.additional_roles)) return false;
  return user.additional_roles.some((ar) => ar.role === roleName);
}

/**
 * Check if user is HOD
 * @param user - User object
 * @returns true if user has HOD additional role
 */
export function isHOD(user: UserWithRoles | null | undefined): boolean {
  return hasAdditionalRole(user, 'hod');
}

/**
 * Get all roles for a user (primary + additional)
 * @param user - User object
 * @returns Array of role names
 */
export function getAllUserRoles(user: UserWithRoles | null | undefined): string[] {
  if (!user) return [];
  const roles = [user.role];
  if (user.additional_roles && Array.isArray(user.additional_roles)) {
    roles.push(...user.additional_roles.map((ar) => ar.role));
  }
  return roles;
}

/**
 * Get department ID from HOD's additional role metadata
 * @param user - User object with additional_roles
 * @returns Department ID if found, null otherwise
 */
export function getHODDepartmentId(user: UserWithRoles | null | undefined): string | null {
  if (!isHOD(user)) return null;
  if (!user?.additional_roles) return null;

  const hodRole = user.additional_roles.find((ar) => ar.role === 'hod');
  if (!hodRole?.metadata) return null;

  return (hodRole.metadata as { departmentId?: string })?.departmentId || null;
}

/**
 * Fetch user with additional roles from database
 * @param client - Database client
 * @param userId - User ID
 * @param tenantId - Tenant ID
 * @returns User with additional_roles populated
 */
export async function getUserWithAdditionalRoles(
  client: PoolClient,
  userId: string,
  tenantId: string
): Promise<UserWithRoles | null> {
  // Get user
  const userResult = await client.query<{
    id: string;
    role: string;
  }>(`SELECT id, role FROM shared.users WHERE id = $1 AND tenant_id = $2`, [userId, tenantId]);

  if (userResult.rows.length === 0) {
    return null;
  }

  const user = userResult.rows[0];

  // Get additional roles
  const rolesResult = await client.query<{
    role: string;
    granted_at: Date;
    granted_by: string | null;
    metadata: Record<string, unknown> | null;
  }>(
    `SELECT role, granted_at, granted_by, metadata
     FROM shared.additional_roles
     WHERE user_id = $1 AND tenant_id = $2`,
    [userId, tenantId]
  );

  return {
    id: user.id,
    role: user.role,
    additional_roles: rolesResult.rows.map((row) => ({
      role: row.role,
      granted_at: row.granted_at.toISOString(),
      granted_by: row.granted_by || undefined,
      metadata: row.metadata || undefined,
    })),
  };
}
