import { getPool } from '../../db/connection';
import { recordSharedAuditLog } from '../auditLogService';

export type OverrideType =
  | 'user_status'
  | 'tenant_status'
  | 'subscription_limit'
  | 'feature_access'
  | 'quota_override'
  | 'rate_limit'
  | 'other';

export interface CreateOverrideInput {
  overrideType: OverrideType;
  targetId: string;
  action: string;
  reason: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface OverrideRecord {
  id: string;
  overrideType: OverrideType;
  targetId: string;
  action: string;
  reason: string;
  createdBy: string;
  expiresAt: Date | null;
  metadata: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
  revokedAt: Date | null;
  revokedBy: string | null;
}

/**
 * Create a new manual override
 */
export async function createOverride(
  input: CreateOverrideInput,
  actorId: string
): Promise<OverrideRecord> {
  const pool = getPool();

  // Check if active override already exists for this target and type
  const existingCheck = await pool.query(
    `
      SELECT id FROM shared.manual_overrides
      WHERE override_type = $1 AND target_id = $2 AND is_active = TRUE
    `,
    [input.overrideType, input.targetId]
  );
  if ((existingCheck.rowCount ?? 0) > 0) {
    throw new Error('Active override already exists for this target');
  }

  const result = await pool.query<OverrideRecord>(
    `
      INSERT INTO shared.manual_overrides (
        override_type, target_id, action, reason, created_by, expires_at, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING *
    `,
    [
      input.overrideType,
      input.targetId,
      input.action,
      input.reason,
      actorId,
      input.expiresAt || null,
      JSON.stringify(input.metadata || {})
    ]
  );

  const override = result.rows[0];

  // Audit log
  await recordSharedAuditLog({
    userId: actorId,
    action: 'OVERRIDE_CREATED',
    entityType: 'OVERRIDE',
    entityId: override.id,
    details: {
      overrideType: input.overrideType,
      targetId: input.targetId,
      action: input.action,
      reason: input.reason
    }
  });

  return override;
}

/**
 * Get override by ID
 */
export async function getOverrideById(overrideId: string): Promise<OverrideRecord | null> {
  const pool = getPool();
  const result = await pool.query<OverrideRecord>(
    'SELECT * FROM shared.manual_overrides WHERE id = $1',
    [overrideId]
  );
  return result.rows[0] || null;
}

/**
 * List overrides with optional filters
 */
export async function listOverrides(filters?: {
  overrideType?: OverrideType;
  targetId?: string;
  isActive?: boolean;
  createdBy?: string;
}): Promise<OverrideRecord[]> {
  const pool = getPool();
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters?.overrideType) {
    conditions.push(`override_type = $${paramIndex++}`);
    values.push(filters.overrideType);
  }
  if (filters?.targetId) {
    conditions.push(`target_id = $${paramIndex++}`);
    values.push(filters.targetId);
  }
  if (filters?.isActive !== undefined) {
    conditions.push(`is_active = $${paramIndex++}`);
    values.push(filters.isActive);
  }
  if (filters?.createdBy) {
    conditions.push(`created_by = $${paramIndex++}`);
    values.push(filters.createdBy);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query<OverrideRecord>(
    `
      SELECT * FROM shared.manual_overrides
      ${whereClause}
      ORDER BY created_at DESC
    `,
    values
  );

  return result.rows;
}

/**
 * Revoke an override
 */
export async function revokeOverride(
  overrideId: string,
  reason?: string,
  actorId?: string | null
): Promise<OverrideRecord> {
  const pool = getPool();

  // Get existing override
  const existingResult = await pool.query<OverrideRecord>(
    'SELECT * FROM shared.manual_overrides WHERE id = $1',
    [overrideId]
  );
  if ((existingResult.rowCount ?? 0) === 0) {
    throw new Error('Override not found');
  }
  const existing = existingResult.rows[0];

  if (!existing.isActive) {
    throw new Error('Override is already revoked');
  }

  const result = await pool.query<OverrideRecord>(
    `
      UPDATE shared.manual_overrides
      SET is_active = FALSE, revoked_at = NOW(), revoked_by = $1
      WHERE id = $2
      RETURNING *
    `,
    [actorId || null, overrideId]
  );

  const revoked = result.rows[0];

  // Audit log
  await recordSharedAuditLog({
    userId: actorId ?? undefined,
    action: 'OVERRIDE_REVOKED',
    entityType: 'OVERRIDE',
    entityId: overrideId,
    details: {
      overrideType: existing.overrideType,
      targetId: existing.targetId,
      reason: reason || 'Override revoked by superuser'
    }
  });

  return revoked;
}

/**
 * Get active overrides for a target
 */
export async function getActiveOverridesForTarget(
  overrideType: OverrideType,
  targetId: string
): Promise<OverrideRecord[]> {
  const pool = getPool();
  const result = await pool.query<OverrideRecord>(
    `
      SELECT * FROM shared.manual_overrides
      WHERE override_type = $1 AND target_id = $2 AND is_active = TRUE
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC
    `,
    [overrideType, targetId]
  );
  return result.rows;
}

/**
 * Clean up expired overrides (should be run periodically)
 */
export async function cleanupExpiredOverrides(): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    `
      UPDATE shared.manual_overrides
      SET is_active = FALSE, revoked_at = NOW()
      WHERE is_active = TRUE
        AND expires_at IS NOT NULL
        AND expires_at <= NOW()
      RETURNING id
    `
  );
  return result.rowCount || 0;
}

