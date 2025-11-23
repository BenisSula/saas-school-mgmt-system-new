import crypto from 'crypto';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { Pool } from 'pg';
import { Role } from '../config/permissions';

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL ?? '900s';
const REFRESH_TOKEN_TTL_SECONDS = Number(process.env.REFRESH_TOKEN_TTL ?? 60 * 60 * 24 * 7); // 7 days

export interface TokenPayload {
  userId: string;
  tenantId: string | null;
  email: string;
  role: Role;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function hashTokenValue(token: string): string {
  return hashToken(token);
}

export function generateAccessToken(payload: TokenPayload): string {
  const secret: Secret = process.env.JWT_ACCESS_SECRET ?? 'change-me-access';
  const tokenId = crypto.randomUUID();
  const options: SignOptions = { expiresIn: ACCESS_TOKEN_TTL as SignOptions['expiresIn'] };

  return jwt.sign(
    {
      sub: payload.userId,
      tenantId: payload.tenantId || '',
      email: payload.email,
      role: payload.role,
      tokenId
    },
    secret,
    options
  );
}

export function generateRefreshToken(payload: TokenPayload): {
  token: string;
  expiresAt: Date;
} {
  const secret: Secret = process.env.JWT_REFRESH_SECRET ?? 'change-me-refresh';
  const tokenId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
  const options: SignOptions = { expiresIn: REFRESH_TOKEN_TTL_SECONDS };

  const token = jwt.sign(
    {
      sub: payload.userId,
      tenantId: payload.tenantId || '',
      email: payload.email,
      role: payload.role,
      tokenId
    },
    secret,
    options
  );

  return { token, expiresAt };
}

export async function storeRefreshToken(
  pool: Pool,
  userId: string,
  token: string,
  expiresAt: Date
): Promise<void> {
  const tokenHash = hashToken(token);
  const id = crypto.randomUUID();

  await pool.query(
    `
      INSERT INTO shared.refresh_tokens (id, user_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, token_hash) DO NOTHING
    `,
    [id, userId, tokenHash, expiresAt.toISOString()]
  );
}

export async function verifyRefreshToken(
  pool: Pool,
  token: string
): Promise<{
  userId: string;
  tenantId: string;
  email: string;
  role: Role;
}> {
  const tokenHash = hashToken(token);

  const result = await pool.query(
    `
      SELECT rt.user_id,
             u.tenant_id,
             u.email,
             u.role
      FROM shared.refresh_tokens rt
      JOIN shared.users u ON u.id = rt.user_id
      WHERE rt.token_hash = $1
        AND rt.expires_at > NOW()
    `,
    [tokenHash]
  );

  if (result.rowCount === 0) {
    throw new Error('Invalid refresh token');
  }

  const row = result.rows[0];
  return {
    userId: row.user_id,
    tenantId: row.tenant_id || '',
    email: row.email,
    role: row.role as Role
  };
}

export async function revokeRefreshToken(pool: Pool, token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await pool.query(`DELETE FROM shared.refresh_tokens WHERE token_hash = $1`, [tokenHash]);
}
