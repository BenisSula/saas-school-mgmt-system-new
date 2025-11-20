import crypto from 'crypto';
import { Pool } from 'pg';
import { isSuperuser } from '../../lib/superuserHelpers';
import { Role } from '../../config/permissions';

export interface CreateSessionInput {
  userId: string;
  tenantId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceInfo?: Record<string, unknown>;
  expiresInSeconds?: number;
}

export interface UserSession {
  id: string;
  userId: string;
  tenantId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceInfo: Record<string, unknown>; // Raw deviceInfo from DB
  normalizedDeviceInfo?: NormalizedDeviceInfo; // Normalized device info
  loginAt: Date;
  logoutAt: Date | null;
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginHistoryFilters {
  userId?: string;
  tenantId?: string | null;
  startDate?: Date;
  endDate?: Date;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Create a new user session record
 * This tracks login events for audit purposes (separate from token-based sessions)
 */
export async function createSession(
  pool: Pool,
  input: CreateSessionInput
): Promise<{ sessionId: string }> {
  const sessionId = crypto.randomUUID();
  const expiresInSeconds = input.expiresInSeconds || DEFAULT_SESSION_TTL_SECONDS;
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + expiresInSeconds);

  await pool.query(
    `
      INSERT INTO shared.user_sessions (
        id, user_id, tenant_id, ip_address, user_agent,
        device_info, login_at, expires_at, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, TRUE)
    `,
    [
      sessionId,
      input.userId,
      input.tenantId || null,
      input.ipAddress || null,
      input.userAgent || null,
      JSON.stringify(input.deviceInfo || {}),
      expiresAt
    ]
  );

  return { sessionId };
}

/**
 * End a user session (logout)
 */
export async function endSession(
  pool: Pool,
  sessionId: string
): Promise<void> {
  await pool.query(
    `
      UPDATE shared.user_sessions
      SET logout_at = NOW(),
          is_active = FALSE,
          updated_at = NOW()
      WHERE id = $1 AND is_active = TRUE
    `,
    [sessionId]
  );
}

/**
 * Get active sessions for a user
 * Superusers can query any user, regular users can only query themselves
 */
export async function getActiveSessions(
  pool: Pool,
  userId: string,
  requesterRole: Role,
  requesterUserId?: string
): Promise<UserSession[]> {
  // Non-superusers can only view their own sessions
  if (!isSuperuser(requesterRole) && requesterUserId !== userId) {
    throw new Error('Unauthorized: You can only view your own sessions');
  }

  const result = await pool.query(
    `
      SELECT 
        id, user_id, tenant_id, ip_address, user_agent, device_info,
        login_at, logout_at, expires_at, is_active, created_at, updated_at
      FROM shared.user_sessions
      WHERE user_id = $1 
        AND is_active = TRUE
        AND expires_at > NOW()
      ORDER BY login_at DESC
    `,
    [userId]
  );

  return result.rows.map(mapRowToSession);
}

/**
 * Get platform-wide active sessions with filters
 * Only accessible by superusers
 */
export async function getPlatformActiveSessions(
  pool: Pool,
  filters: {
    userId?: string;
    tenantId?: string | null;
    limit?: number;
    offset?: number;
  },
  requesterRole: Role
): Promise<{ sessions: UserSession[]; total: number }> {
  if (!isSuperuser(requesterRole)) {
    throw new Error('Unauthorized: Superuser access required');
  }

  const conditions: string[] = ['is_active = TRUE', 'expires_at > NOW()'];
  const values: unknown[] = [];
  let paramIndex = 1;

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

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM shared.user_sessions ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get sessions
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;
  const limitValues = [...values, limit, offset];

  const sessionsResult = await pool.query(
    `
      SELECT 
        id, user_id, tenant_id, ip_address, user_agent, device_info,
        login_at, logout_at, expires_at, is_active, created_at, updated_at
      FROM shared.user_sessions
      ${whereClause}
      ORDER BY login_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `,
    limitValues
  );

  return {
    sessions: sessionsResult.rows.map(mapRowToSession),
    total
  };
}

/**
 * Get login history for a user
 * Superusers can query any user, regular users can only query themselves
 */
export async function getLoginHistory(
  pool: Pool,
  filters: LoginHistoryFilters,
  requesterRole: Role,
  requesterUserId?: string
): Promise<{ sessions: UserSession[]; total: number }> {
  // Non-superusers can only view their own history
  if (filters.userId && !isSuperuser(requesterRole) && requesterUserId !== filters.userId) {
    throw new Error('Unauthorized: You can only view your own login history');
  }

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

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

  if (filters.startDate) {
    conditions.push(`login_at >= $${paramIndex++}`);
    values.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push(`login_at <= $${paramIndex++}`);
    values.push(filters.endDate);
  }

  if (filters.isActive !== undefined) {
    conditions.push(`is_active = $${paramIndex++}`);
    values.push(filters.isActive);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM shared.user_sessions ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get sessions
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  values.push(limit, offset);

  const sessionsResult = await pool.query(
    `
      SELECT 
        id, user_id, tenant_id, ip_address, user_agent, device_info,
        login_at, logout_at, expires_at, is_active, created_at, updated_at
      FROM shared.user_sessions
      ${whereClause}
      ORDER BY login_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `,
    values
  );

  return {
    sessions: sessionsResult.rows.map(mapRowToSession),
    total
  };
}

/**
 * Revoke all active sessions for a user
 * Only superusers can revoke sessions for other users
 */
export async function revokeAllUserSessions(
  pool: Pool,
  userId: string,
  requesterRole: Role,
  requesterUserId?: string,
  exceptSessionId?: string
): Promise<number> {
  // Non-superusers can only revoke their own sessions
  if (!isSuperuser(requesterRole) && requesterUserId !== userId) {
    throw new Error('Unauthorized: You can only revoke your own sessions');
  }

  const conditions: string[] = ['user_id = $1', 'is_active = TRUE'];
  const values: unknown[] = [userId];
  let paramIndex = 2;

  if (exceptSessionId) {
    conditions.push(`id != $${paramIndex++}`);
    values.push(exceptSessionId);
  }

  const result = await pool.query(
    `
      UPDATE shared.user_sessions
      SET is_active = FALSE,
          logout_at = NOW(),
          updated_at = NOW()
      WHERE ${conditions.join(' AND ')}
      RETURNING id
    `,
    values
  );

  return result.rowCount || 0;
}

/**
 * Auto-expire stale sessions (sessions past their expiration date)
 * This should be run periodically via a cron job
 */
export async function autoExpireStaleSessions(pool: Pool): Promise<number> {
  const result = await pool.query(
    `
      UPDATE shared.user_sessions
      SET is_active = FALSE,
          updated_at = NOW()
      WHERE is_active = TRUE
        AND expires_at < NOW()
    `
  );

  return result.rowCount || 0;
}

/**
 * Map database row to UserSession type
 */
function mapRowToSession(row: {
  id: string;
  user_id: string;
  tenant_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_info: unknown;
  login_at: Date;
  logout_at: Date | null;
  expires_at: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}): UserSession {
  const rawDeviceInfo = (row.device_info as Record<string, unknown>) || {};
  
  // Normalize device info (use existing deviceInfo if available, otherwise parse userAgent)
  const normalizedDeviceInfo = normalizeDeviceInfo(rawDeviceInfo, row.user_agent);
  
  return {
    id: row.id,
    userId: row.user_id,
    tenantId: row.tenant_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    deviceInfo: rawDeviceInfo,
    normalizedDeviceInfo,
    loginAt: row.login_at,
    logoutAt: row.logout_at,
    expiresAt: row.expires_at,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

