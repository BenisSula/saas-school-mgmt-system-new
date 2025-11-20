import crypto from 'crypto';
import type { PoolClient } from 'pg';

export interface CreateSessionInput {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: Record<string, unknown>;
  mfaVerified?: boolean;
  expiresInSeconds?: number;
}

/**
 * Create a new session
 */
export async function createSession(
  client: PoolClient,
  input: CreateSessionInput
): Promise<{ sessionId: string; token: string }> {
  const sessionId = crypto.randomUUID();
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  
  const expiresInSeconds = input.expiresInSeconds || 7 * 24 * 60 * 60; // Default 7 days
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + expiresInSeconds);

  await client.query(
    `
      INSERT INTO shared.sessions (
        id, user_id, token_hash, ip_address, user_agent,
        device_info, mfa_verified, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      sessionId,
      input.userId,
      tokenHash,
      input.ipAddress || null,
      input.userAgent || null,
      JSON.stringify(input.deviceInfo || {}),
      input.mfaVerified || false,
      expiresAt
    ]
  );

  return { sessionId, token };
}

/**
 * Get session by token
 */
export async function getSessionByToken(
  client: PoolClient,
  token: string
): Promise<unknown | null> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const result = await client.query(
    `
      SELECT * FROM shared.sessions
      WHERE token_hash = $1
      AND expires_at > NOW()
      AND revoked_at IS NULL
    `,
    [tokenHash]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * Update session last activity
 */
export async function updateSessionActivity(
  client: PoolClient,
  sessionId: string
): Promise<void> {
  await client.query(
    `
      UPDATE shared.sessions
      SET last_activity_at = NOW()
      WHERE id = $1 AND revoked_at IS NULL
    `,
    [sessionId]
  );
}

/**
 * Revoke a session
 */
export async function revokeSession(
  client: PoolClient,
  sessionId: string,
  userId?: string
): Promise<void> {
  const conditions: string[] = ['id = $1'];
  const values: unknown[] = [sessionId];
  let paramIndex = 2;

  if (userId) {
    conditions.push(`user_id = $${paramIndex++}`);
    values.push(userId);
  }

  await client.query(
    `
      UPDATE shared.sessions
      SET revoked_at = NOW()
      WHERE ${conditions.join(' AND ')}
    `,
    values
  );
}

/**
 * Revoke all sessions for a user
 */
export async function revokeAllUserSessions(
  client: PoolClient,
  userId: string,
  exceptSessionId?: string
): Promise<void> {
  const conditions: string[] = ['user_id = $1', 'revoked_at IS NULL'];
  const values: unknown[] = [userId];
  let paramIndex = 2;

  if (exceptSessionId) {
    conditions.push(`id != $${paramIndex++}`);
    values.push(exceptSessionId);
  }

  await client.query(
    `
      UPDATE shared.sessions
      SET revoked_at = NOW()
      WHERE ${conditions.join(' AND ')}
    `,
    values
  );
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(
  client: PoolClient,
  userId: string
): Promise<unknown[]> {
  const result = await client.query(
    `
      SELECT id, ip_address, user_agent, device_info, mfa_verified,
             last_activity_at, expires_at, created_at
      FROM shared.sessions
      WHERE user_id = $1
      AND expires_at > NOW()
      AND revoked_at IS NULL
      ORDER BY last_activity_at DESC
    `,
    [userId]
  );

  return result.rows;
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(
  client: PoolClient
): Promise<number> {
  const result = await client.query(
    `
      DELETE FROM shared.sessions
      WHERE expires_at < NOW()
      OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '30 days')
    `
  );

  return result.rowCount || 0;
}

