import { Pool, PoolClient } from 'pg';
import { requireSuperuser } from '../../lib/superuserHelpers';
import { Role } from '../../config/permissions';
import {
  createAuditLog,
  searchAuditLogs,
  AuditLogFilters,
  AuditLogEntry
} from '../audit/enhancedAuditService';
import {
  normalizeDeviceInfo,
  type NormalizedDeviceInfo
} from '../../lib/serializers/deviceInfoSerializer';

/**
 * Log a platform-level audit event
 * This extends the existing audit logging system with superuser-specific events
 */
export async function logAuditEvent(
  client: PoolClient,
  entry: {
    tenantId?: string | null;
    userId?: string | null;
    action: string;
    resourceType?: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string | null;
    userAgent?: string | null;
    requestId?: string;
    severity?: 'info' | 'warning' | 'error' | 'critical';
    tags?: string[];
  }
): Promise<void> {
  await createAuditLog(client, {
    tenantId: entry.tenantId || undefined,
    userId: entry.userId || undefined,
    action: entry.action,
    resourceType: entry.resourceType || undefined,
    resourceId: entry.resourceId || undefined,
    details: entry.details || {},
    ipAddress: entry.ipAddress || undefined,
    userAgent: entry.userAgent || undefined,
    requestId: entry.requestId || undefined,
    severity: entry.severity || 'info',
    tags: entry.tags || []
  });
}

/**
 * Get platform-wide audit logs
 * Only superusers can access this
 */
export async function getPlatformAuditLogs(
  client: PoolClient,
  filters: AuditLogFilters,
  requesterRole: Role
): Promise<{ logs: AuditLogEntry[]; total: number }> {
  requireSuperuser(requesterRole);

  return await searchAuditLogs(client, filters);
}

/**
 * Log login attempt (successful or failed)
 * This integrates with the login_attempts table from migration 015
 */
export async function logLoginAttempt(
  pool: Pool,
  entry: {
    email: string;
    userId?: string | null;
    tenantId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    success: boolean;
    failureReason?: string | null;
  }
): Promise<void> {
  await pool.query(
    `
      INSERT INTO shared.login_attempts (
        email, user_id, tenant_id, ip_address, user_agent,
        success, failure_reason, attempted_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `,
    [
      entry.email,
      entry.userId || null,
      entry.tenantId || null,
      entry.ipAddress || null,
      entry.userAgent || null,
      entry.success,
      entry.failureReason || null
    ]
  );

  // Also log to audit_logs for critical failures
  if (!entry.success) {
    // Get a client for audit logging
    const auditClient = await pool.connect();
    try {
      await logAuditEvent(auditClient, {
        tenantId: entry.tenantId || null,
        userId: entry.userId || null,
        action: 'LOGIN_ATTEMPT_FAILED',
        resourceType: 'authentication',
        details: {
          email: entry.email,
          failureReason: entry.failureReason || 'Unknown'
        },
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
        severity: 'warning',
        tags: ['security', 'authentication']
      });
    } finally {
      auditClient.release();
    }
  }
}

/**
 * Get login attempts for analysis
 * Only superusers can access this
 */
export interface LoginAttemptFilters {
  email?: string;
  userId?: string;
  tenantId?: string | null;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export async function getLoginAttempts(
  pool: Pool,
  filters: LoginAttemptFilters,
  requesterRole: Role
): Promise<{ attempts: LoginAttemptRecord[]; total: number }> {
  requireSuperuser(requesterRole);

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.email) {
    conditions.push(`email = $${paramIndex++}`);
    values.push(filters.email);
  }

  if (filters.userId) {
    conditions.push(`user_id = $${paramIndex++}`);
    values.push(filters.userId);
  }

  if (filters.tenantId !== undefined) {
    if (filters.tenantId === null) {
      conditions.push(`tenant_id IS NULL`);
    } else {
      conditions.push(`tenant_id = $${paramIndex++}`);
      values.push(filters.tenantId);
    }
  }

  if (filters.success !== undefined) {
    conditions.push(`success = $${paramIndex++}`);
    values.push(filters.success);
  }

  if (filters.startDate) {
    conditions.push(`attempted_at >= $${paramIndex++}`);
    values.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push(`attempted_at <= $${paramIndex++}`);
    values.push(filters.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM shared.login_attempts ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get attempts
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  values.push(limit, offset);

  const attemptsResult = await pool.query(
    `
      SELECT 
        id, email, user_id, tenant_id, ip_address, user_agent,
        success, failure_reason, attempted_at
      FROM shared.login_attempts
      ${whereClause}
      ORDER BY attempted_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `,
    values
  );

  return {
    attempts: attemptsResult.rows.map(mapLoginAttemptRow),
    total
  };
}

/**
 * Map database row to LoginAttemptRecord type
 */
function mapLoginAttemptRow(row: {
  id: string;
  email: string;
  user_id: string | null;
  tenant_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  failure_reason: string | null;
  attempted_at: Date;
}): LoginAttemptRecord {
  // Normalize device info from userAgent
  const deviceInfo = normalizeDeviceInfo(null, row.user_agent);

  return {
    id: row.id,
    email: row.email,
    userId: row.user_id,
    tenantId: row.tenant_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    deviceInfo,
    success: row.success,
    failureReason: row.failure_reason,
    attemptedAt: row.attempted_at
  };
}

export interface LoginAttemptRecord {
  id: string;
  email: string;
  userId: string | null;
  tenantId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceInfo?: NormalizedDeviceInfo; // Normalized device information
  success: boolean;
  failureReason: string | null;
  attemptedAt: Date;
}
