import argon2 from 'argon2';
import crypto from 'crypto';
import { Pool } from 'pg';
import { getPool } from '../db/connection';
import { withDbClient, tableExists, columnExists } from '../lib/dbHelpers';
import { Role } from '../config/permissions';
import { buildWhereClauseFromFilters } from '../lib/queryUtils';

type UserRole = 'student' | 'teacher' | 'hod' | 'admin' | 'superadmin';

export interface TenantUser {
  id: string;
  email: string;
  role: UserRole;
  is_verified: boolean;
  status: string | null;
  created_at: string;
  additional_roles?: Array<{ role: string; metadata?: Record<string, unknown> }>;
  pending_profile_data?: Record<string, unknown> | null; // Profile data for pending users
}

export async function listTenantUsers(
  tenantId: string,
  filters?: { status?: string; role?: string }
): Promise<TenantUser[]> {
  const pool = getPool();

  // Build WHERE clause using query utils
  const filterConditions: Record<string, unknown> = {
    'u.tenant_id': tenantId,
  };

  if (filters?.status) {
    filterConditions['u.status'] = filters.status;
  }

  if (filters?.role) {
    filterConditions['u.role'] = filters.role;
  }

  const { whereClause, params } = buildWhereClauseFromFilters(filterConditions);

  // Query users and their roles separately to avoid pg-mem compatibility issues
  // with jsonb_build_object/json_build_object
  const usersResult = await pool.query(
    `
      SELECT 
        u.id, 
        u.email, 
        u.role, 
        u.is_verified, 
        u.status, 
        u.created_at,
        u.pending_profile_data
      FROM shared.users u
      ${whereClause}
      ORDER BY u.role, u.created_at DESC
    `,
    params
  );

  // Get additional roles for all users in one query
  // Check if additional_roles table exists
  const tableCheck = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'shared' 
      AND table_name = 'additional_roles'
    )
  `);
  const tableExists = tableCheck.rows[0]?.exists ?? false;

  const userIds = usersResult.rows.map((row) => row.id);
  let rolesResult: {
    rows: Array<{ user_id: string; role: string; granted_at: Date; granted_by?: string }>;
  } = {
    rows: [],
  };

  if (userIds.length > 0 && tableExists) {
    const placeholders = userIds.map((_, i) => `$${i + 1}`).join(', ');
    rolesResult = await pool.query(
      `
        SELECT user_id, role, granted_at, granted_by
        FROM shared.additional_roles
        WHERE user_id IN (${placeholders})
      `,
      userIds
    );
  }

  // Group roles by user_id
  const rolesByUserId = new Map<
    string,
    Array<{ role: string; granted_at?: string; granted_by?: string }>
  >();
  for (const roleRow of rolesResult.rows) {
    if (!rolesByUserId.has(roleRow.user_id)) {
      rolesByUserId.set(roleRow.user_id, []);
    }
    rolesByUserId.get(roleRow.user_id)!.push({
      role: roleRow.role,
      granted_at: roleRow.granted_at?.toISOString(),
      granted_by: roleRow.granted_by ?? undefined,
    });
  }

  // Combine users with their additional roles
  return usersResult.rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    is_verified: row.is_verified,
    status: row.status,
    created_at: row.created_at,
    additional_roles: rolesByUserId.get(row.id) || [],
    pending_profile_data: row.pending_profile_data as Record<string, unknown> | null | undefined,
  }));
}

/**
 * Assign an additional role to a user (e.g., 'hod' to a teacher).
 * Maintains backward compatibility if additional_roles table doesn't exist.
 */
export async function assignAdditionalRole(
  userId: string,
  role: string,
  grantedBy: string,
  tenantId: string
): Promise<void> {
  await withDbClient(async (client) => {
    // Check if additional_roles table exists
    const exists = await tableExists(client, 'shared', 'additional_roles');

    if (exists) {
      // Insert or update additional role
      await client.query(
        `
          INSERT INTO shared.additional_roles (user_id, role, granted_by, tenant_id)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (user_id, role, tenant_id)
          DO UPDATE SET granted_by = EXCLUDED.granted_by, granted_at = NOW()
        `,
        [userId, role, grantedBy, tenantId]
      );
    } else {
      // Fallback: log warning for legacy support
      console.warn(
        '[userService] additional_roles table does not exist, falling back to legacy role update'
      );
    }
  });
}

/**
 * Remove an additional role from a user.
 * Maintains backward compatibility if additional_roles table doesn't exist.
 */
export async function removeAdditionalRole(
  userId: string,
  role: string,
  tenantId: string
): Promise<void> {
  await withDbClient(async (client) => {
    // Check if additional_roles table exists
    const exists = await tableExists(client, 'shared', 'additional_roles');

    if (exists) {
      // Delete additional role
      await client.query(
        `
          DELETE FROM shared.additional_roles
          WHERE user_id = $1 AND role = $2 AND tenant_id = $3
        `,
        [userId, role, tenantId]
      );
    } else {
      // Fallback: log warning for legacy support
      console.warn('[userService] additional_roles table does not exist, skipping role removal');
    }
  });
}

/**
 * Bulk remove HOD role from multiple users.
 * Returns the number of roles successfully removed.
 */
export async function bulkRemoveHODRoles(
  userIds: string[],
  tenantId: string,
  actorId: string
): Promise<{ removed: number; failed: number }> {
  if (userIds.length === 0) {
    return { removed: 0, failed: 0 };
  }

  return withDbClient(async (client) => {
    // Check if additional_roles table exists
    const exists = await tableExists(client, 'shared', 'additional_roles');
    if (!exists) {
      throw new Error('additional_roles table does not exist');
    }

    let removed = 0;
    let failed = 0;

    // Remove HOD role for each user
    for (const userId of userIds) {
      try {
        const result = await client.query(
          `
            DELETE FROM shared.additional_roles
            WHERE user_id = $1 AND role = 'hod' AND tenant_id = $2
          `,
          [userId, tenantId]
        );
        if (result.rowCount && result.rowCount > 0) {
          removed++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`[userService] Failed to remove HOD role for user ${userId}:`, error);
        failed++;
      }
    }

    console.info('[audit] bulk_hod_removed', {
      tenantId,
      actorId,
      totalRequested: userIds.length,
      removed,
      failed,
    });

    return { removed, failed };
  });
}

/**
 * Update department for a user with HOD role in additional_roles metadata.
 * Note: This requires the metadata column to exist in additional_roles table.
 */
export async function updateHODDepartment(
  userId: string,
  department: string,
  tenantId: string,
  updatedBy: string
): Promise<void> {
  await withDbClient(async (client) => {
    // Check if additional_roles table exists
    const tableExistsCheck = await tableExists(client, 'shared', 'additional_roles');
    if (!tableExistsCheck) {
      throw new Error('additional_roles table does not exist');
    }

    // Check if metadata column exists
    const hasMetadataColumn = await columnExists(client, 'shared', 'additional_roles', 'metadata');
    if (!hasMetadataColumn) {
      throw new Error(
        'metadata column does not exist in additional_roles table. Please run migration to add it.'
      );
    }

    // Check if user has HOD role
    const hodRoleCheck = await client.query(
      `
        SELECT id FROM shared.additional_roles
        WHERE user_id = $1 AND role = 'hod' AND tenant_id = $2
      `,
      [userId, tenantId]
    );

    if (hodRoleCheck.rowCount === 0) {
      throw new Error('User does not have HOD role');
    }

    // Update metadata with department (merge with existing metadata)
    await client.query(
      `
        UPDATE shared.additional_roles
        SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('department', $1),
            granted_by = $2,
            granted_at = COALESCE(granted_at, NOW())
        WHERE user_id = $3 AND role = 'hod' AND tenant_id = $4
      `,
      [department, updatedBy, userId, tenantId]
    );
  });
}

/**
 * Get user with additional roles populated.
 * Returns user object with additional_roles array.
 */
export async function getUserWithAdditionalRoles(
  userId: string,
  tenantId: string
): Promise<
  TenantUser & {
    additional_roles?: Array<{ role: string; granted_at: string; granted_by?: string }>;
  }
> {
  return withDbClient(async (client) => {
    // Get user
    const userResult = await client.query(
      `
        SELECT id, email, role, is_verified, status, created_at
        FROM shared.users
        WHERE id = $1 AND tenant_id = $2
      `,
      [userId, tenantId]
    );

    if (userResult.rowCount === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];

    // Check if additional_roles table exists
    const tableExistsCheck = await tableExists(client, 'shared', 'additional_roles');

    let additionalRoles: Array<{ role: string; granted_at: string; granted_by?: string }> = [];

    if (tableExistsCheck) {
      // Get additional roles
      const rolesResult = await client.query(
        `
          SELECT role, granted_at, granted_by
          FROM shared.additional_roles
          WHERE user_id = $1 AND tenant_id = $2
        `,
        [userId, tenantId]
      );

      additionalRoles = rolesResult.rows.map((row) => ({
        role: row.role,
        granted_at: row.granted_at.toISOString(),
        granted_by: row.granted_by ?? undefined,
      }));
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      is_verified: user.is_verified,
      status: user.status,
      created_at: user.created_at,
      additional_roles: additionalRoles,
    };
  });
}

export async function updateTenantUserRole(
  tenantId: string,
  userId: string,
  role: UserRole,
  actorId: string
): Promise<TenantUser | null> {
  return withDbClient(async (client) => {
    // If assigning HOD role, use additional_roles table instead of direct role update
    if (role === 'hod') {
      // Verify user's current role is 'teacher' (HODs must be teachers)
      const currentUserResult = await client.query(
        `SELECT role FROM shared.users WHERE id = $1 AND tenant_id = $2`,
        [userId, tenantId]
      );

      if (currentUserResult.rowCount === 0) {
        return null;
      }

      const currentRole = currentUserResult.rows[0].role;
      if (currentRole !== 'teacher') {
        throw new Error('HOD role can only be assigned to teachers');
      }

      // Assign HOD as additional role, keep role = 'teacher'
      await assignAdditionalRole(userId, 'hod', actorId, tenantId);

      // Return user with additional roles
      return await getUserWithAdditionalRoles(userId, tenantId);
    }

    // DEPRECATED: Direct role update for non-HOD roles
    // TODO: Consider migrating all role updates to use additional_roles in future
    const updateResult = await client.query(
      `
        UPDATE shared.users
        SET role = $1
        WHERE id = $2
          AND tenant_id = $3
        RETURNING id, email, role, is_verified, status, created_at
      `,
      [role, userId, tenantId]
    );

    if (updateResult.rowCount === 0) {
      return null;
    }

    const user = updateResult.rows[0];

    const rolesResult = await client.query(
      `
        SELECT 
          role_name,
          metadata
        FROM shared.user_roles
        WHERE user_id = $1
      `,
      [userId]
    );

    console.info('[audit] user_role_updated', {
      tenantId,
      userId,
      newRole: role,
      actorId,
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      is_verified: user.is_verified,
      status: user.status,
      created_at: user.created_at,
      additional_roles: rolesResult.rows.map((row) => ({
        role: row.role_name,
        metadata: row.metadata || {},
      })),
    };
  });
}

export interface CreateUserInput {
  email: string;
  password: string;
  role: Role;
  tenantId: string | null;
  status?: 'pending' | 'active' | 'rejected' | 'suspended';
  isVerified?: boolean;
  // Optional extended fields (for superuser admin creation)
  username?: string;
  fullName?: string;
  phone?: string | null;
  schoolId?: string | null;
  createdBy?: string | null;
  auditLogEnabled?: boolean;
  isTeachingStaff?: boolean;
  // Profile data submitted during registration (stored as JSONB)
  pendingProfileData?: Record<string, unknown> | null;
}

export interface CreatedUser {
  id: string;
  email: string;
  role: Role;
  tenant_id: string | null;
  is_verified: boolean;
  status: string;
  created_at: string;
  username?: string;
  full_name?: string;
}

/**
 * Centralized user creation function.
 * Handles password hashing and inserts user into shared.users table.
 * This is the single source of truth for user creation logic.
 */
export async function createUser(pool: Pool, input: CreateUserInput): Promise<CreatedUser> {
  const normalizedEmail = input.email.toLowerCase();
  const passwordHash = await argon2.hash(input.password);
  const userId = crypto.randomUUID();

  // Determine status - default to 'pending' if not provided
  const userStatus = input.status ?? 'pending';
  const isVerified = input.isVerified ?? (input.role === 'superadmin' || input.role === 'admin');

  // Build the INSERT query dynamically based on provided fields
  const fields: string[] = [
    'id',
    'email',
    'password_hash',
    'role',
    'tenant_id',
    'is_verified',
    'status',
  ];
  const values: unknown[] = [
    userId,
    normalizedEmail,
    passwordHash,
    input.role,
    input.tenantId,
    isVerified,
    userStatus,
  ];

  // Add optional extended fields if provided
  if (input.username !== undefined) {
    fields.push('username');
    values.push(input.username.toLowerCase());
  }
  if (input.fullName !== undefined) {
    fields.push('full_name');
    values.push(input.fullName);
  }
  if (input.phone !== undefined) {
    fields.push('phone');
    values.push(input.phone);
  }
  if (input.schoolId !== undefined) {
    fields.push('school_id');
    values.push(input.schoolId);
  }
  if (input.createdBy !== undefined) {
    fields.push('created_by');
    values.push(input.createdBy);
  }
  if (input.auditLogEnabled !== undefined) {
    fields.push('audit_log_enabled');
    values.push(input.auditLogEnabled);
  }
  if (input.isTeachingStaff !== undefined) {
    fields.push('is_teaching_staff');
    values.push(input.isTeachingStaff);
  }
  if (input.pendingProfileData !== undefined && input.pendingProfileData !== null) {
    fields.push('pending_profile_data');
    values.push(JSON.stringify(input.pendingProfileData));
  }

  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

  const result = await pool.query(
    `
      INSERT INTO shared.users (${fields.join(', ')})
      VALUES (${placeholders})
      RETURNING id, email, role, tenant_id, is_verified, status, created_at, username, full_name
    `,
    values
  );

  return result.rows[0] as CreatedUser;
}

export async function updateUserStatus(
  tenantId: string,
  userId: string,
  status: 'pending' | 'active' | 'rejected' | 'suspended',
  actorId: string
): Promise<TenantUser | null> {
  return withDbClient(async (client) => {
    // Get user info before update (needed for profile processing)
    const userBeforeUpdate = await client.query(
      `
        SELECT id, email, role, pending_profile_data
        FROM shared.users
        WHERE id = $1 AND tenant_id = $2
      `,
      [userId, tenantId]
    );

    if (userBeforeUpdate.rowCount === 0) {
      return null;
    }

    // Update status
    const updateResult = await client.query(
      `
        UPDATE shared.users
        SET status = $1
        WHERE id = $2
          AND tenant_id = $3
        RETURNING id, email, role, is_verified, status, created_at
      `,
      [status, userId, tenantId]
    );

    if (updateResult.rowCount === 0) {
      return null;
    }

    const user = updateResult.rows[0];

    const rolesResult = await client.query(
      `
        SELECT 
          role_name,
          metadata
        FROM shared.user_roles
        WHERE user_id = $1
      `,
      [userId]
    );

    console.info('[audit] user_status_updated', {
      tenantId,
      userId,
      newStatus: status,
      actorId,
    });

    // Process profile data based on status change
    // Note: Profile processing requires tenant context, so it's handled in the route handler
    // where req.tenantClient and req.tenant are available

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      is_verified: user.is_verified,
      status: user.status,
      created_at: user.created_at,
      additional_roles: rolesResult.rows.map((row) => ({
        role: row.role_name,
        metadata: row.metadata || {},
      })),
    };
  });
}
