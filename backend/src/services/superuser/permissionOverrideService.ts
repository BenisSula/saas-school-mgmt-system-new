import { getPool } from '../../db/connection';
import { recordSharedAuditLog } from '../auditLogService';
import { Permission } from '../../config/permissions';

export interface GrantPermissionOverrideInput {
  userId: string;
  permission: Permission;
  reason?: string;
  expiresAt?: Date;
}

export interface RevokePermissionOverrideInput {
  userId: string;
  permission: Permission;
  reason?: string;
}

export interface PermissionOverrideRecord {
  id: string;
  userId: string;
  permission: Permission;
  granted: boolean;
  grantedBy: string;
  reason: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}

/**
 * Grant a permission override to a user
 */
export async function grantPermissionOverride(
  input: GrantPermissionOverrideInput,
  actorId: string
): Promise<PermissionOverrideRecord> {
  const pool = getPool();

  // Verify user exists
  const userCheck = await pool.query('SELECT id FROM shared.users WHERE id = $1', [input.userId]);
  if (userCheck.rowCount === 0) {
    throw new Error('User not found');
  }

  // Check if override already exists
  const existingCheck = await pool.query(
    'SELECT id FROM shared.permission_overrides WHERE user_id = $1 AND permission = $2',
    [input.userId, input.permission]
  );

  let result;
  if ((existingCheck.rowCount ?? 0) > 0) {
    // Update existing override
    result = await pool.query<PermissionOverrideRecord>(
      `
        UPDATE shared.permission_overrides
        SET granted = TRUE, granted_by = $1, reason = $2, expires_at = $3, created_at = NOW()
        WHERE user_id = $4 AND permission = $5
        RETURNING *
      `,
      [actorId, input.reason || null, input.expiresAt || null, input.userId, input.permission]
    );
  } else {
    // Create new override
    result = await pool.query<PermissionOverrideRecord>(
      `
        INSERT INTO shared.permission_overrides (
          user_id, permission, granted, granted_by, reason, expires_at
        )
        VALUES ($1, $2, TRUE, $3, $4, $5)
        RETURNING *
      `,
      [input.userId, input.permission, actorId, input.reason || null, input.expiresAt || null]
    );
  }

  const override = result.rows[0];

  // Audit log
  await recordSharedAuditLog({
    userId: actorId,
    action: 'PERMISSION_OVERRIDE_GRANTED',
    entityType: 'PERMISSION_OVERRIDE',
    entityId: override.id,
    details: {
      userId: input.userId,
      permission: input.permission,
      reason: input.reason,
    },
  });

  return override;
}

/**
 * Revoke a permission override from a user
 */
export async function revokePermissionOverride(
  input: RevokePermissionOverrideInput,
  actorId: string
): Promise<void> {
  const pool = getPool();

  // Check if override exists
  const existingCheck = await pool.query(
    'SELECT id FROM shared.permission_overrides WHERE user_id = $1 AND permission = $2',
    [input.userId, input.permission]
  );
  if ((existingCheck.rowCount ?? 0) === 0) {
    throw new Error('Permission override not found');
  }

  // Delete the override
  await pool.query(
    'DELETE FROM shared.permission_overrides WHERE user_id = $1 AND permission = $2',
    [input.userId, input.permission]
  );

  // Audit log
  await recordSharedAuditLog({
    userId: actorId,
    action: 'PERMISSION_OVERRIDE_REVOKED',
    entityType: 'PERMISSION_OVERRIDE',
    entityId: existingCheck.rows[0].id,
    details: {
      userId: input.userId,
      permission: input.permission,
      reason: input.reason,
    },
  });
}

/**
 * Get permission overrides for a user
 */
export async function getPermissionOverridesForUser(
  userId: string
): Promise<PermissionOverrideRecord[]> {
  const pool = getPool();
  const result = await pool.query<PermissionOverrideRecord>(
    `
      SELECT * FROM shared.permission_overrides
      WHERE user_id = $1
        AND granted = TRUE
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC
    `,
    [userId]
  );
  return result.rows;
}

/**
 * Get all permission overrides with optional filters
 */
export async function listPermissionOverrides(filters?: {
  userId?: string;
  permission?: Permission;
  grantedBy?: string;
}): Promise<PermissionOverrideRecord[]> {
  const pool = getPool();
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters?.userId) {
    conditions.push(`user_id = $${paramIndex++}`);
    values.push(filters.userId);
  }
  if (filters?.permission) {
    conditions.push(`permission = $${paramIndex++}`);
    values.push(filters.permission);
  }
  if (filters?.grantedBy) {
    conditions.push(`granted_by = $${paramIndex++}`);
    values.push(filters.grantedBy);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query<PermissionOverrideRecord>(
    `
      SELECT * FROM shared.permission_overrides
      ${whereClause}
      ORDER BY created_at DESC
    `,
    values
  );

  return result.rows;
}

/**
 * Check if a user has a permission override (for use in permission checks)
 */
export async function hasPermissionOverride(
  userId: string,
  permission: Permission
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT id FROM shared.permission_overrides
      WHERE user_id = $1 AND permission = $2
        AND granted = TRUE
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `,
    [userId, permission]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Clean up expired permission overrides (should be run periodically)
 */
export async function cleanupExpiredPermissionOverrides(): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    `
      DELETE FROM shared.permission_overrides
      WHERE expires_at IS NOT NULL AND expires_at <= NOW()
      RETURNING id
    `
  );
  return result.rowCount || 0;
}
