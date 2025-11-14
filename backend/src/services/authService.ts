import argon2 from 'argon2';
import crypto from 'crypto';
import { Pool } from 'pg';
import { getPool } from '../db/connection';
import { runMigrations } from '../db/runMigrations';
import { Role } from '../config/permissions';
import {
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  TokenPayload
} from './tokenService';
import {
  recordLoginEvent,
  recordLogoutEvent,
  rotateSessionToken,
  SessionContext
} from './platformMonitoringService';
import { createTenant as createTenantSchema, createSchemaSlug } from '../db/tenantManager';
import { createUser } from './userService';

const PASSWORD_RESET_TTL = Number(process.env.PASSWORD_RESET_TTL ?? 60 * 30); // 30 minutes
const EMAIL_VERIFICATION_TTL = Number(process.env.EMAIL_VERIFICATION_TTL ?? 60 * 60 * 24); // 24 hours

export interface SignUpInput {
  email: string;
  password: string;
  role: Role;
  tenantId?: string;
  tenantName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: {
    id: string;
    email: string;
    role: Role;
    tenantId: string | null;
    isVerified: boolean;
    status: 'pending' | 'active' | 'suspended' | 'rejected';
  };
}

interface DbUserRow {
  id: string;
  email: string;
  role: Role;
  tenant_id: string | null;
  is_verified: boolean;
  password_hash?: string;
  status?: string;
}

async function getDbPool(): Promise<Pool> {
  const pool = getPool();
  return pool;
}

async function findTenantById(pool: Pool, tenantId: string) {
  const result = await pool.query(`SELECT * FROM shared.tenants WHERE id = $1`, [tenantId]);
  return result.rows[0];
}

async function findUserByEmail(pool: Pool, email: string): Promise<DbUserRow | undefined> {
  const result = await pool.query(`SELECT * FROM shared.users WHERE email = $1`, [email]);
  return result.rows[0];
}

function buildTokenPayload(user: DbUserRow): TokenPayload {
  return {
    userId: user.id,
    tenantId: user.tenant_id ?? '',
    email: user.email,
    role: user.role as Role
  };
}

export async function signUp(input: SignUpInput): Promise<AuthResponse> {
  const pool = await getDbPool();
  const normalizedEmail = input.email.toLowerCase();

  const existing = await findUserByEmail(pool, normalizedEmail);
  if (existing) {
    throw new Error('User already exists');
  }

  let resolvedTenantId: string | null = null;

  if (input.role === 'superadmin') {
    resolvedTenantId = null;
  } else if (input.tenantId) {
    const tenant = await findTenantById(pool, input.tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }
    resolvedTenantId = tenant.id;
  } else if (input.role === 'admin' && input.tenantName) {
    const tenantName = input.tenantName.trim();
    if (!tenantName) {
      throw new Error('Tenant name is required for admin registration without tenant ID');
    }

    const schemaName = createSchemaSlug(tenantName);
    const tenant = await createTenantSchema(
      {
        name: tenantName,
        schemaName,
        subscriptionType: 'trial',
        status: 'active',
        billingEmail: normalizedEmail
      },
      pool
    );
    resolvedTenantId = tenant.id;
  } else if (input.role === 'admin' && !input.tenantId) {
    throw new Error('Either tenantId or tenantName is required for admin registration');
  } else if (!input.tenantId) {
    throw new Error('tenantId is required for non-admin roles');
  } else {
    const tenant = await findTenantById(pool, input.tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }
    resolvedTenantId = tenant.id;
  }

  // Determine user status based on role and context
  let userStatus: 'pending' | 'active' = 'pending';
  if (input.role === 'superadmin') {
    userStatus = 'active';
  } else if (input.role === 'admin' && input.tenantName) {
    // Admin creating new tenant is automatically active
    userStatus = 'active';
  } else if (input.role === 'admin' && input.tenantId) {
    // Admin joining existing tenant needs approval
    userStatus = 'pending';
  }
  // teacher, student, hod default to 'pending' (requires admin approval)

  // Use centralized user creation function
  const createdUser = await createUser(pool, {
    email: normalizedEmail,
    password: input.password,
    role: input.role,
    tenantId: resolvedTenantId,
    status: userStatus,
    isVerified: input.role === 'superadmin' || input.role === 'admin'
  });

  const user: DbUserRow = {
    id: createdUser.id,
    email: createdUser.email,
    role: createdUser.role,
    tenant_id: createdUser.tenant_id,
    is_verified: createdUser.is_verified,
    status: createdUser.status
  };

  const payload = buildTokenPayload(user);
  const accessToken = generateAccessToken(payload);
  const { token: refreshToken, expiresAt } = generateRefreshToken(payload);
  await storeRefreshToken(pool, user.id, refreshToken, expiresAt);

  await createEmailVerificationToken(pool, user.id, user.email);

  return {
    accessToken,
    refreshToken,
    expiresIn: process.env.ACCESS_TOKEN_TTL ?? '900s',
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id,
      isVerified: user.is_verified,
      status: (user.status as 'pending' | 'active' | 'suspended' | 'rejected') ?? 'pending'
    }
  };
}

export async function login(input: LoginInput, context?: SessionContext): Promise<AuthResponse> {
  const pool = await getDbPool();
  const normalizedEmail = input.email.toLowerCase();
  const user = await findUserByEmail(pool, normalizedEmail);

  if (!user || !user.password_hash) {
    throw new Error('Invalid credentials');
  }

  const passwordValid = await argon2.verify(user.password_hash, input.password);
  if (!passwordValid) {
    throw new Error('Invalid credentials');
  }

  const payload = buildTokenPayload(user);
  const accessToken = generateAccessToken(payload);
  const { token: refreshToken, expiresAt } = generateRefreshToken(payload);
  await storeRefreshToken(pool, user.id, refreshToken, expiresAt);

  const response: AuthResponse = {
    accessToken,
    refreshToken,
    expiresIn: process.env.ACCESS_TOKEN_TTL ?? '900s',
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id,
      isVerified: user.is_verified,
      status: (user.status as 'pending' | 'active' | 'suspended' | 'rejected') ?? 'pending'
    }
  };

  await recordLoginEvent(user.id, refreshToken, context);

  return response;
}

export async function refreshToken(token: string, context?: SessionContext): Promise<AuthResponse> {
  const pool = await getDbPool();
  const tokenInfo = await verifyRefreshToken(pool, token);

  const userResult = await pool.query(
    `SELECT id, email, role, tenant_id, is_verified FROM shared.users WHERE id = $1`,
    [tokenInfo.userId]
  );

  if (userResult.rowCount === 0) {
    throw new Error('User not found');
  }

  const user = userResult.rows[0] as DbUserRow;
  const payload = buildTokenPayload(user);
  const accessToken = generateAccessToken(payload);
  const { token: newRefreshToken, expiresAt } = generateRefreshToken(payload);

  await revokeRefreshToken(pool, token);
  await storeRefreshToken(pool, user.id, newRefreshToken, expiresAt);

  await rotateSessionToken(user.id, token, newRefreshToken, context);

  return {
    accessToken,
    refreshToken: newRefreshToken,
    expiresIn: process.env.ACCESS_TOKEN_TTL ?? '900s',
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id,
      isVerified: user.is_verified,
      status: (user.status as 'pending' | 'active' | 'suspended' | 'rejected') ?? 'pending'
    }
  };
}

export async function logout(
  userId: string,
  refreshTokenValue: string,
  context?: SessionContext
): Promise<void> {
  const pool = await getDbPool();
  await revokeRefreshToken(pool, refreshTokenValue);
  await recordLogoutEvent(userId, refreshTokenValue, context);
}

export async function requestPasswordReset(email: string): Promise<{ token: string }> {
  const pool = await getDbPool();
  const normalizedEmail = email.toLowerCase();
  const user = await findUserByEmail(pool, normalizedEmail);

  if (!user) {
    return { token: '' };
  }

  const token = crypto.randomUUID();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL * 1000);
  const id = crypto.randomUUID();

  await pool.query(
    `
      INSERT INTO shared.password_reset_tokens (id, user_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
    `,
    [id, user.id, tokenHash, expiresAt.toISOString()]
  );

  console.log(`[auth] Password reset token for ${normalizedEmail}: ${token}`);

  return { token };
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const pool = await getDbPool();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const result = await pool.query(
    `
      SELECT prt.user_id
      FROM shared.password_reset_tokens prt
      WHERE prt.token_hash = $1
        AND prt.expires_at > NOW()
    `,
    [tokenHash]
  );

  if (result.rowCount === 0) {
    throw new Error('Invalid or expired token');
  }

  const userId = result.rows[0].user_id;
  const passwordHash = await argon2.hash(newPassword);

  await pool.query(`UPDATE shared.users SET password_hash = $1 WHERE id = $2`, [
    passwordHash,
    userId
  ]);

  await pool.query(`DELETE FROM shared.password_reset_tokens WHERE token_hash = $1`, [tokenHash]);
}

export async function createEmailVerificationToken(
  pool: Pool,
  userId: string,
  email: string
): Promise<void> {
  const token = crypto.randomUUID();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL * 1000);
  const id = crypto.randomUUID();

  await pool.query(
    `
      INSERT INTO shared.email_verification_tokens (id, user_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, token_hash) DO NOTHING
    `,
    [id, userId, tokenHash, expiresAt.toISOString()]
  );

  console.log(`[auth] Email verification token for ${email}: ${token}`);
}

export async function verifyEmail(token: string): Promise<void> {
  const pool = await getDbPool();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const result = await pool.query(
    `
      SELECT evt.user_id
      FROM shared.email_verification_tokens evt
      WHERE evt.token_hash = $1
        AND evt.expires_at > NOW()
    `,
    [tokenHash]
  );

  if (result.rowCount === 0) {
    throw new Error('Invalid or expired token');
  }

  const userId = result.rows[0].user_id;

  await pool.query(`UPDATE shared.users SET is_verified = TRUE WHERE id = $1`, [userId]);
  await pool.query(`DELETE FROM shared.email_verification_tokens WHERE token_hash = $1`, [
    tokenHash
  ]);
}

export async function createTenant(input: {
  name: string;
  domain?: string;
  schemaName: string;
}): Promise<{ id: string }> {
  const pool = await getDbPool();
  await runMigrations(pool);

  const result = await pool.query(
    `
      INSERT INTO shared.tenants (name, domain, schema_name)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [input.name, input.domain ?? null, input.schemaName]
  );

  return { id: result.rows[0].id };
}

export async function requestEmailVerification(userId: string, email: string): Promise<void> {
  const pool = await getDbPool();
  await createEmailVerificationToken(pool, userId, email.toLowerCase());
}
