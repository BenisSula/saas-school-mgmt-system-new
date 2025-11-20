import { hashPassword } from '../lib/passwordHashing';
import { validatePassword } from '../lib/passwordPolicy';
import { AuthError, AuthErrorCode } from '../lib/authErrorCodes';
import crypto from 'crypto';
import { Pool } from 'pg';
import { getPool } from '../db/connection';
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
    'u.tenant_id': tenantId
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
  const userIds = usersResult.rows.map((row) => row.id);
  let rolesResult: { rows: Array<{ user_id: string; role_name: string; metadata: unknown }> } = {
    rows: []
  };

  if (userIds.length > 0) {
    const placeholders = userIds.map((_, i) => `$${i + 1}`).join(', ');
    rolesResult = await pool.query(
      `
        SELECT user_id, role_name, metadata
        FROM shared.user_roles
        WHERE user_id IN (${placeholders})
      `,
      userIds
    );
  }

  // Group roles by user_id
  const rolesByUserId = new Map<
    string,
    Array<{ role: string; metadata: Record<string, unknown> }>
  >();
  for (const roleRow of rolesResult.rows) {
    if (!rolesByUserId.has(roleRow.user_id)) {
      rolesByUserId.set(roleRow.user_id, []);
    }
    rolesByUserId.get(roleRow.user_id)!.push({
      role: roleRow.role_name,
      metadata: (roleRow.metadata as Record<string, unknown>) || {}
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
    pending_profile_data: row.pending_profile_data as Record<string, unknown> | null | undefined
  }));
}

export async function updateTenantUserRole(
  tenantId: string,
  userId: string,
  role: UserRole,
  actorId: string
): Promise<TenantUser | null> {
  const pool = getPool();
  const client = await pool.connect();
  try {
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
      actorId
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
        metadata: row.metadata || {}
      }))
    };
  } finally {
    client.release();
  }
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
  departmentId?: string | null;
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

  // Validate password policy
  const passwordValidation = validatePassword(input.password);
  if (!passwordValidation.isValid) {
    throw new AuthError(
      `Password does not meet requirements: ${passwordValidation.errors.join('; ')}`,
      AuthErrorCode.PASSWORD_POLICY_VIOLATION,
      'password',
      422
    );
  }

  // Use secure password hashing
  const passwordHash = await hashPassword(input.password);
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
    'status'
  ];
  const values: unknown[] = [
    userId,
    normalizedEmail,
    passwordHash,
    input.role,
    input.tenantId,
    isVerified,
    userStatus
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
  if (input.departmentId !== undefined) {
    fields.push('department_id');
    values.push(input.departmentId);
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

export async function updateUserPassword(
  tenantId: string,
  userId: string,
  newPassword: string,
  actorId: string
): Promise<TenantUser | null> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Verify user belongs to tenant
    const userCheck = await client.query(
      `
        SELECT id, email, role
        FROM shared.users
        WHERE id = $1 AND tenant_id = $2
      `,
      [userId, tenantId]
    );

    if (userCheck.rowCount === 0) {
      return null;
    }

    // Hash the new password
    // Validate password policy
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      throw new AuthError(
        `Password does not meet requirements: ${passwordValidation.errors.join('; ')}`,
        AuthErrorCode.PASSWORD_POLICY_VIOLATION,
        'password',
        422
      );
    }

    // Use secure password hashing
    const passwordHash = await hashPassword(newPassword);

    // Update password
    await client.query(
      `
        UPDATE shared.users
        SET password_hash = $1
        WHERE id = $2 AND tenant_id = $3
      `,
      [passwordHash, userId, tenantId]
    );

    // Get updated user
    const result = await client.query(
      `
        SELECT id, email, role, is_verified, status, created_at
        FROM shared.users
        WHERE id = $1 AND tenant_id = $2
      `,
      [userId, tenantId]
    );

    const user = result.rows[0];

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

    console.info('[audit] user_password_updated', {
      tenantId,
      userId,
      actorId
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
        metadata: row.metadata || {}
      }))
    };
  } finally {
    client.release();
  }
}

export async function updateUserStatus(
  tenantId: string,
  userId: string,
  status: 'pending' | 'active' | 'rejected' | 'suspended',
  actorId: string
): Promise<TenantUser | null> {
  const pool = getPool();
  const client = await pool.connect();
  try {
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
      actorId
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
        metadata: row.metadata || {}
      }))
    };
  } finally {
    client.release();
  }
}
