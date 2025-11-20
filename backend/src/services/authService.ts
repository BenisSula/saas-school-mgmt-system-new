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
import { createSchemaSlug, runTenantMigrations, seedTenant } from '../db/tenantManager';
import { registerUser, type UserRegistrationInput } from './userRegistrationService';
import { validateSignupInput, normalizeSignupPayload } from './authValidation';

const PASSWORD_RESET_TTL = Number(process.env.PASSWORD_RESET_TTL ?? 60 * 30); // 30 minutes
const EMAIL_VERIFICATION_TTL = Number(process.env.EMAIL_VERIFICATION_TTL ?? 60 * 60 * 24); // 24 hours

export interface SignUpInput {
  email: string;
  password: string;
  role: Role;
  tenantId?: string;
  tenantName?: string;
  profile?: {
    // Common fields
    fullName?: string;
    gender?: 'male' | 'female' | 'other';
    address?: string;
    // Student-specific fields
    dateOfBirth?: string;
    parentGuardianName?: string;
    parentGuardianContact?: string;
    studentId?: string;
    classId?: string;
    // Teacher-specific fields
    phone?: string;
    qualifications?: string;
    yearsOfExperience?: number;
    subjects?: string[];
    teacherId?: string;
  };
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  mustChangePassword?: boolean; // Flag indicating user must change password after login
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
  status?: string | null; // May be null if migration hasn't run
}

interface ErrorWithCode extends Error {
  code?: string;
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
  const pool = getPool();

  // Validate and normalize input (this will throw ValidationError if invalid)
  const validatedInput = validateSignupInput(input);
  const normalizedInput = normalizeSignupPayload(validatedInput);

  // Check for duplicate email
  const existing = await findUserByEmail(pool, normalizedInput.email);
  if (existing) {
    const error: ErrorWithCode = new Error('User with this email already exists');
    error.code = 'DUPLICATE_EMAIL';
    throw error;
  }

  let resolvedTenantId: string | null = null;

  // Resolve tenant ID based on role and input
  if (normalizedInput.tenantId) {
    const tenant = await findTenantById(pool, normalizedInput.tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }
    resolvedTenantId = tenant.id;
  } else if (normalizedInput.role === 'admin' && normalizedInput.tenantName) {
    // Admin creating new tenant - wrap in transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const schemaName = createSchemaSlug(normalizedInput.tenantName);

      // Create schema within transaction
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);

      // Run tenant migrations and seed (these use their own connections, but schema exists)
      await runTenantMigrations(pool, schemaName);
      await seedTenant(pool, schemaName);

      // Create tenant record within transaction using the client
      const tenantId = crypto.randomUUID();
      const tenantResult = await client.query(
        `
          INSERT INTO shared.tenants (id, name, domain, schema_name, subscription_type, status, billing_email)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `,
        [
          tenantId,
          normalizedInput.tenantName,
          null, // domain
          schemaName,
          'trial',
          'active',
          normalizedInput.email
        ]
      );
      resolvedTenantId = tenantResult.rows[0].id;

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (normalizedInput.role !== 'admin') {
    // Student and teacher must have tenantId (validated above, but double-check)
    throw new Error('tenantId is required for non-admin roles');
  }

  // Use unified registration service for self-registration
  const registrationInput: UserRegistrationInput = {
    email: normalizedInput.email,
    password: normalizedInput.password,
    role: normalizedInput.role as 'student' | 'teacher' | 'admin',
    tenantId: resolvedTenantId || undefined,
    tenantName: normalizedInput.tenantName,
    // Profile data from input.profile
    ...(normalizedInput.profile || {})
  };

  // Determine if user should be immediately active
  const immediateActivation: boolean =
    normalizedInput.role === 'admin' && !!normalizedInput.tenantName;

  const registrationResult = await registerUser(
    resolvedTenantId,
    null, // No tenantClient for self-registration (profile created on approval)
    null, // No schema for self-registration
    registrationInput,
    {
      immediateActivation,
      createProfileImmediately: false // Profile created when admin approves
    }
  );

  const user: DbUserRow = {
    id: registrationResult.userId,
    email: registrationResult.email,
    role: registrationResult.role,
    tenant_id: resolvedTenantId,
    is_verified: registrationResult.isVerified,
    status: registrationResult.status
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
  try {
    const pool = getPool();
    const normalizedEmail = input.email.toLowerCase();

    let user: DbUserRow | undefined;
    try {
      user = await findUserByEmail(pool, normalizedEmail);
    } catch (dbError) {
      console.error('[auth] Database error finding user:', dbError);
      throw new Error('Database error during login');
    }

    if (!user || !user.password_hash) {
      throw new Error('Invalid credentials');
    }

    let passwordValid: boolean;
    try {
      passwordValid = await argon2.verify(user.password_hash, input.password);
    } catch (verifyError) {
      console.error('[auth] Password verification error:', verifyError);
      throw new Error('Invalid credentials');
    }

    if (!passwordValid) {
      throw new Error('Invalid credentials');
    }

    let payload: TokenPayload;
    let accessToken: string;
    let refreshToken: string;
    let expiresAt: Date;

    try {
      payload = buildTokenPayload(user);
      accessToken = generateAccessToken(payload);
      const refreshResult = generateRefreshToken(payload);
      refreshToken = refreshResult.token;
      expiresAt = refreshResult.expiresAt;
    } catch (tokenError) {
      console.error('[auth] Token generation error:', tokenError);
      throw new Error('Failed to generate authentication tokens');
    }

    try {
      await storeRefreshToken(pool, user.id, refreshToken, expiresAt);
    } catch (storeError) {
      console.error('[auth] Failed to store refresh token:', storeError);
      // Don't fail login if refresh token storage fails - user can still login
    }

    // Safely get status - handle case where column might not exist
    let userStatus: 'pending' | 'active' | 'suspended' | 'rejected' = 'pending';
    if (user.status) {
      userStatus = user.status as 'pending' | 'active' | 'suspended' | 'rejected';
    } else {
      // If status column doesn't exist or is null, default to 'pending'
      // This handles cases where migrations haven't run yet
      console.warn(`[auth] User ${user.id} has no status, defaulting to 'pending'`);
    }

    // Check if user has a temporary password (admin reset)
    // Look for recent admin_reset in password_change_history
    let mustChangePassword = false;
    try {
      const passwordHistoryResult = await pool.query(
        `
          SELECT change_type, metadata, changed_at
          FROM shared.password_change_history
          WHERE user_id = $1
            AND change_type = 'admin_reset'
          ORDER BY changed_at DESC
          LIMIT 1
        `,
        [user.id]
      );

      if (passwordHistoryResult.rows.length > 0) {
        const latestReset = passwordHistoryResult.rows[0];
        const metadata = latestReset.metadata || {};
        
        // Check if this was a temporary password reset
        if (metadata.temporaryPassword === true) {
          // Check if user hasn't changed password since reset
          // If the latest password change is still the admin_reset, user must change password
          const latestChangeResult = await pool.query(
            `
              SELECT change_type
              FROM shared.password_change_history
              WHERE user_id = $1
              ORDER BY changed_at DESC
              LIMIT 1
            `,
            [user.id]
          );

          if (latestChangeResult.rows.length > 0) {
            const latestChange = latestChangeResult.rows[0];
            // If latest change is still admin_reset (not self_reset or admin_change), must change
            if (latestChange.change_type === 'admin_reset') {
              mustChangePassword = true;
            }
          }
        }
      }
    } catch (historyError: unknown) {
      // If password_change_history table doesn't exist, ignore (user can login normally)
      const errorMessage = historyError instanceof Error ? historyError.message : String(historyError);
      if (!errorMessage.includes('does not exist') && !errorMessage.includes('relation')) {
        console.error('[auth] Error checking password history:', historyError);
      }
    }

    const response: AuthResponse = {
      accessToken,
      refreshToken,
      expiresIn: process.env.ACCESS_TOKEN_TTL ?? '900s',
      mustChangePassword,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id,
        isVerified: user.is_verified,
        status: userStatus
      }
    };

    // Record login event - don't fail login if this fails
    try {
      await recordLoginEvent(user.id, refreshToken, context);
      
      // Also log successful login attempt
      const { logLoginAttempt } = await import('./superuser/platformAuditService');
      await logLoginAttempt(pool, {
        email: user.email,
        success: true,
        ipAddress: context?.ip || null,
        userAgent: context?.userAgent || null,
        userId: user.id,
        tenantId: user.tenant_id,
        failureReason: null
      });
    } catch (error) {
      // Log error but don't fail the login
      console.error('[auth] Failed to record login event:', error);
    }

    return response;
  } catch (error) {
    // Re-throw known errors
    if (
      error instanceof Error &&
      (error.message.includes('Invalid credentials') ||
        error.message.includes('Database error') ||
        error.message.includes('Failed to generate'))
    ) {
      throw error;
    }

    // Log unexpected errors
    console.error('[auth] Unexpected login error:', error);
    throw new Error('An unexpected error occurred during login');
  }
}

export async function refreshToken(token: string, context?: SessionContext): Promise<AuthResponse> {
  const pool = getPool();
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
  const pool = getPool();
  await revokeRefreshToken(pool, refreshTokenValue);
  await recordLogoutEvent(userId, refreshTokenValue, context);
}

export async function requestPasswordReset(email: string): Promise<{ token: string }> {
  const pool = getPool();
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
  const pool = getPool();
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
  const pool = getPool();
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
  const pool = getPool();
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
  const pool = getPool();
  await createEmailVerificationToken(pool, userId, email.toLowerCase());
}
