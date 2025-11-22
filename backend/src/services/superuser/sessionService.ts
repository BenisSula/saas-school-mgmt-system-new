import crypto from 'crypto';
import { Pool } from 'pg';
import { isSuperuser } from '../../lib/superuserHelpers';
import { Role } from '../../config/permissions';
import {
  normalizeDeviceInfo,
  type NormalizedDeviceInfo
} from '../../lib/serializers/deviceInfoSerializer';

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

  // Check if table exists and has required columns
  try {
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'shared' 
        AND table_name = 'user_sessions'
        AND column_name IN ('is_active', 'expires_at', 'tenant_id', 'ip_address', 'user_agent', 'device_info')
    `);
    
    const hasIsActive = columnCheck.rows.some((row: { column_name: string }) => row.column_name === 'is_active');
    const hasExpiresAt = columnCheck.rows.some((row: { column_name: string }) => row.column_name === 'expires_at');
    const hasTenantId = columnCheck.rows.some((row: { column_name: string }) => row.column_name === 'tenant_id');
    const hasIpAddress = columnCheck.rows.some((row: { column_name: string }) => row.column_name === 'ip_address');
    const hasUserAgent = columnCheck.rows.some((row: { column_name: string }) => row.column_name === 'user_agent');
    const hasDeviceInfo = columnCheck.rows.some((row: { column_name: string }) => row.column_name === 'device_info');
    
    // Build INSERT query based on available columns
    const columns: string[] = ['id', 'user_id', 'login_at'];
    const values: unknown[] = [sessionId, input.userId];
    let placeholderIndex = 3;
    
    if (hasTenantId) {
      columns.push('tenant_id');
      values.push(input.tenantId || null);
      placeholderIndex++;
    }
    if (hasIpAddress) {
      columns.push('ip_address');
      values.push(input.ipAddress || null);
      placeholderIndex++;
    }
    if (hasUserAgent) {
      columns.push('user_agent');
      values.push(input.userAgent || null);
      placeholderIndex++;
    }
    if (hasDeviceInfo) {
      columns.push('device_info');
      values.push(JSON.stringify(input.deviceInfo || {}));
      placeholderIndex++;
    }
    if (hasExpiresAt) {
      columns.push('expires_at');
      values.push(expiresAt);
      placeholderIndex++;
    }
    if (hasIsActive) {
      columns.push('is_active');
      values.push(true);
      // placeholderIndex not needed after this
    }
    
    // Build placeholders - login_at should use NOW()
    const placeholders: string[] = [];
    let phIndex = 1;
    for (const col of columns) {
      if (col === 'login_at') {
        placeholders.push('NOW()');
      } else {
        placeholders.push(`$${phIndex++}`);
      }
    }
    
    await pool.query(
      `
        INSERT INTO shared.user_sessions (${columns.join(', ')})
        VALUES (${placeholders.join(', ')})
      `,
      values
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // If table doesn't exist, silently fail (sessions tracking is optional)
    if (errorMessage.includes('does not exist') || errorMessage.includes('42703')) {
      // Return sessionId anyway - session creation is optional
      return { sessionId };
    }
    throw error;
  }

  return { sessionId };
}

/**
 * End a user session (logout)
 */
export async function endSession(pool: Pool, sessionId: string): Promise<void> {
  try {
    // Check if required columns exist
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'shared' 
        AND table_name = 'user_sessions'
        AND column_name IN ('is_active', 'updated_at', 'logout_at')
    `);
    
    const hasIsActive = columnCheck.rows.some((row: { column_name: string }) => row.column_name === 'is_active');
    const hasUpdatedAt = columnCheck.rows.some((row: { column_name: string }) => row.column_name === 'updated_at');
    
    if (!hasIsActive) {
      // If is_active doesn't exist, just set logout_at
      await pool.query(
        `UPDATE shared.user_sessions SET logout_at = NOW() WHERE id = $1`,
        [sessionId]
      );
      return;
    }
    
    const updateClause = hasUpdatedAt
      ? 'SET logout_at = NOW(), is_active = FALSE, updated_at = NOW()'
      : 'SET logout_at = NOW(), is_active = FALSE';
    
    await pool.query(
      `
        UPDATE shared.user_sessions
        ${updateClause}
        WHERE id = $1 AND is_active = TRUE
      `,
      [sessionId]
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // If table/columns don't exist, silently fail (session tracking is optional)
    if (errorMessage.includes('does not exist') || errorMessage.includes('42703')) {
      return;
    }
    throw error;
  }
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

  // Check if required columns exist
  const columnCheck = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'shared' 
      AND table_name = 'user_sessions'
      AND column_name IN ('is_active', 'expires_at')
  `);
  
  const hasIsActive = columnCheck.rows.some((row: { column_name: string }) => row.column_name === 'is_active');
  const hasExpiresAt = columnCheck.rows.some((row: { column_name: string }) => row.column_name === 'expires_at');
  
  // If required columns don't exist, return empty result
  if (!hasIsActive || !hasExpiresAt) {
    return { sessions: [], total: 0 };
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

  // Get sessions - build SELECT based on available columns
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;
  const limitValues = [...values, limit, offset];
  
  // Check which columns exist for SELECT
  const selectColumnsCheck = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'shared' 
      AND table_name = 'user_sessions'
      AND column_name IN ('id', 'user_id', 'tenant_id', 'ip_address', 'user_agent', 'device_info', 'login_at', 'logout_at', 'expires_at', 'is_active', 'created_at', 'updated_at')
  `);
  
  const availableColumns = selectColumnsCheck.rows.map((row: { column_name: string }) => row.column_name);
  const baseColumns = ['id', 'user_id', 'login_at'];
  const optionalColumns = ['tenant_id', 'ip_address', 'user_agent', 'device_info', 'logout_at', 'expires_at', 'is_active', 'created_at', 'updated_at'];
  
  const selectColumns = [
    ...baseColumns,
    ...optionalColumns.filter(col => availableColumns.includes(col))
  ].join(', ');

  const sessionsResult = await pool.query(
    `
      SELECT ${selectColumns}
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

  // Check if table exists
  try {
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'shared' 
        AND table_name = 'user_sessions'
      )
    `);
    
    if (!tableCheck.rows[0]?.exists) {
      return { sessions: [], total: 0 };
    }
  } catch {
    return { sessions: [], total: 0 };
  }

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.userId) {
    conditions.push(`user_id = $${paramIndex++}`);
    values.push(filters.userId);
  }

  // Check if tenant_id column exists before using it
  try {
    const tenantIdCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'shared' 
        AND table_name = 'user_sessions'
        AND column_name = 'tenant_id'
      )
    `);
    
    if (tenantIdCheck.rows[0]?.exists && filters.tenantId !== undefined) {
      if (filters.tenantId === null) {
        conditions.push(`tenant_id IS NULL`);
      } else {
        conditions.push(`tenant_id = $${paramIndex++}`);
        values.push(filters.tenantId);
      }
    }
  } catch {
    // Column doesn't exist, skip tenant filter
  }

  if (filters.startDate) {
    conditions.push(`login_at >= $${paramIndex++}`);
    values.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push(`login_at <= $${paramIndex++}`);
    values.push(filters.endDate);
  }

  // Check if is_active column exists before using it
  try {
    const isActiveCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'shared' 
        AND table_name = 'user_sessions'
        AND column_name = 'is_active'
      )
    `);
    
    if (isActiveCheck.rows[0]?.exists && filters.isActive !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      values.push(filters.isActive);
    }
  } catch {
    // Column doesn't exist, skip is_active filter
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

  try {
    // Check if required columns exist
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'shared' 
        AND table_name = 'user_sessions'
        AND column_name IN ('is_active', 'updated_at', 'logout_at')
    `);
    
    const hasIsActive = columnCheck.rows.some((row: { column_name: string }) => row.column_name === 'is_active');
    const hasUpdatedAt = columnCheck.rows.some((row: { column_name: string }) => row.column_name === 'updated_at');
    const hasLogoutAt = columnCheck.rows.some((row: { column_name: string }) => row.column_name === 'logout_at');
    
    if (!hasIsActive) {
      return 0; // Can't revoke if is_active doesn't exist
    }
    
    const conditions: string[] = ['user_id = $1', 'is_active = TRUE'];
    const values: unknown[] = [userId];
    let paramIndex = 2;

    if (exceptSessionId) {
      conditions.push(`id != $${paramIndex++}`);
      values.push(exceptSessionId);
    }
    
    const updateParts: string[] = ['is_active = FALSE'];
    if (hasLogoutAt) {
      updateParts.push('logout_at = NOW()');
    }
    if (hasUpdatedAt) {
      updateParts.push('updated_at = NOW()');
    }

    const result = await pool.query(
      `
        UPDATE shared.user_sessions
        SET ${updateParts.join(', ')}
        WHERE ${conditions.join(' AND ')}
        RETURNING id
      `,
      values
    );

    return result.rowCount || 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // If table/columns don't exist, return 0 (no sessions revoked)
    if (errorMessage.includes('does not exist') || errorMessage.includes('42703')) {
      return 0;
    }
    throw error;
  }
}

/**
 * Auto-expire stale sessions (sessions past their expiration date)
 * This should be run periodically via a cron job
 */
export async function autoExpireStaleSessions(pool: Pool): Promise<number> {
  // Check if table exists and has required columns
  try {
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'shared' 
        AND table_name = 'user_sessions'
        AND column_name IN ('is_active', 'expires_at', 'updated_at')
    `);
    
    const hasRequiredColumns = columnCheck.rows.length >= 2; // At least is_active and expires_at
    
    if (!hasRequiredColumns) {
      return 0; // Table exists but missing required columns
    }
    
    // Build UPDATE query based on available columns
    const hasUpdatedAt = columnCheck.rows.some((row: { column_name: string }) => row.column_name === 'updated_at');
    const updateClause = hasUpdatedAt 
      ? 'SET is_active = FALSE, updated_at = NOW()'
      : 'SET is_active = FALSE';
    
    const result = await pool.query(
      `
        UPDATE shared.user_sessions
        ${updateClause}
        WHERE is_active = TRUE
          AND expires_at < NOW()
      `
    );

    return result.rowCount || 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // If table doesn't exist, return 0 (no error)
    if (errorMessage.includes('does not exist') || errorMessage.includes('42703')) {
      return 0;
    }
    throw error;
  }
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
