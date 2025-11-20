import argon2 from 'argon2';
import crypto from 'crypto';
import { Pool } from 'pg';
import { getPool } from '../db/connection';
import { runMigrations } from '../db/runMigrations';
import { Role } from '../config/permissions';
import { emailService } from './emailService';
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
import { createSchemaSlug, runTenantMigrations } from '../db/tenantManager';
import { registerUser, type UserRegistrationInput } from './userRegistrationService';
import { validateSignupInput, normalizeSignupPayload } from './authValidation';
import { AuthError, AuthErrorCode } from '../lib/authErrorCodes';
import { validatePassword } from '../lib/passwordPolicy';
import { hashPassword, verifyPassword } from '../lib/passwordHashing';

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

async function findTenantById(pool: Pool, tenantId: string) {
  const result = await pool.query(`SELECT * FROM shared.tenants WHERE id = $1`, [tenantId]);
  return result.rows[0];
}

async function findUserByEmail(pool: Pool, email: string): Promise<DbUserRow | undefined> {
  const result = await pool.query(`SELECT * FROM shared.users WHERE email = $1`, [email]);
  return result.rows[0];
}

function buildTokenPayload(user: DbUserRow): TokenPayload {
  // Ensure tenantId is always set for non-superadmin users
  const tenantId = user.tenant_id ?? '';
  if (!tenantId && user.role !== 'superadmin') {
    console.warn(`[auth] User ${user.email} (${user.id}) has no tenant_id but is not superadmin`);
  }
  return {
    userId: user.id,
    tenantId,
    email: user.email,
    role: user.role as Role
  };
}

export async function signUp(input: SignUpInput): Promise<AuthResponse> {
  const pool = getPool();

  // Validate and normalize input (this will throw ValidationError if invalid)
  const validatedInput = validateSignupInput(input);
  const normalizedInput = normalizeSignupPayload(validatedInput);

  // Validate password policy
  const passwordValidation = validatePassword(normalizedInput.password);
  if (!passwordValidation.isValid) {
    throw new AuthError(
      `Password does not meet requirements: ${passwordValidation.errors.join('; ')}`,
      AuthErrorCode.PASSWORD_POLICY_VIOLATION,
      'password',
      422
    );
  }

  // Check for duplicate email
  const existing = await findUserByEmail(pool, normalizedInput.email);
  if (existing) {
    throw new AuthError(
      'User with this email already exists',
      AuthErrorCode.DUPLICATE_EMAIL,
      'email',
      409
    );
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
    // Admin creating new tenant - create record immediately, prepare in background
    const schemaName = createSchemaSlug(normalizedInput.tenantName);

    // Import here to avoid circular dependency
    const { createTenantWithPendingStatus, prepareTenantInBackground } = await import('./tenantPreparationService');
    const { executeBackgroundJob } = await import('./backgroundJobService');

    // Create tenant record with 'pending' status
    const tenantResult = await createTenantWithPendingStatus({
      name: normalizedInput.tenantName,
      schemaName,
      subscriptionType: 'trial',
      status: 'active',
      billingEmail: normalizedInput.email
    });
    resolvedTenantId = tenantResult.id;

    // Start background preparation job
    const tenantIdForJob = resolvedTenantId;
    if (!tenantIdForJob) {
      throw new Error('Tenant ID is required for background preparation');
    }
    const tenantName = normalizedInput.tenantName;
    if (!tenantName) {
      throw new Error('Tenant name is required');
    }
    executeBackgroundJob(
      'tenant_preparation',
      () => prepareTenantInBackground(tenantIdForJob, {
        name: tenantName,
        schemaName,
        subscriptionType: 'trial',
        status: 'active',
        billingEmail: normalizedInput.email || null
      })
    );

    console.log(`[auth] Tenant ${tenantIdForJob} created with pending status, preparation started in background`);
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

  try {
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

    // Record signup event for audit
    try {
      await recordLoginEvent(user.id, refreshToken, {
        ip: undefined,
        userAgent: undefined
      });
    } catch (error) {
      console.error('[auth] Failed to record signup event:', error);
      // Don't fail signup if audit logging fails
    }

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
  } catch (error) {
    // Re-throw AuthError as-is
    if (error instanceof AuthError) {
      throw error;
    }
    // Wrap other errors
    if (error instanceof Error) {
      if (error.message.includes('Tenant not found')) {
        throw new AuthError(error.message, AuthErrorCode.TENANT_NOT_FOUND, 'tenantId', 404);
      }
    }
    throw error;
  }
}

export async function login(input: LoginInput, context?: SessionContext): Promise<AuthResponse> {
  const pool = getPool();
  const normalizedEmail = input.email.toLowerCase();

  let user: DbUserRow | undefined;
  try {
    user = await findUserByEmail(pool, normalizedEmail);
  } catch (dbError) {
    console.error('[auth] Database error finding user:', dbError);
    throw new AuthError(
      'Database error during login',
      AuthErrorCode.INTERNAL_ERROR,
      undefined,
      500
    );
  }

  if (!user || !user.password_hash) {
    throw new AuthError(
      'Invalid email or password',
      AuthErrorCode.INVALID_CREDENTIALS,
      'password',
      401
    );
  }

  // Check account status before password verification
  let userStatus: 'pending' | 'active' | 'suspended' | 'rejected' = 'pending';
  if (user.status) {
    userStatus = user.status as 'pending' | 'active' | 'suspended' | 'rejected';
  }

  // Check if account is suspended or rejected
  if (userStatus === 'suspended') {
    throw new AuthError(
      'Your account has been suspended. Please contact an administrator.',
      AuthErrorCode.ACCOUNT_SUSPENDED,
      undefined,
      403
    );
  }

  if (userStatus === 'rejected') {
    throw new AuthError(
      'Your account registration was rejected. Please contact support.',
      AuthErrorCode.ACCOUNT_REJECTED,
      undefined,
      403
    );
  }

  // Check if email is verified
  if (!user.is_verified) {
    throw new AuthError(
      'Please verify your email address before logging in.',
      AuthErrorCode.EMAIL_UNVERIFIED,
      'email',
      403
    );
  }

  // Verify password using secure password verification
  let passwordValid: boolean;
  try {
    passwordValid = await verifyPassword(user.password_hash, input.password);
  } catch (verifyError) {
    console.error('[auth] Password verification error:', verifyError);
    throw new AuthError(
      'Invalid email or password',
      AuthErrorCode.INVALID_CREDENTIALS,
      'password',
      401
    );
  }

  if (!passwordValid) {
    throw new AuthError(
      'Invalid email or password',
      AuthErrorCode.INVALID_CREDENTIALS,
      'password',
      401
    );
  }

  // Check if account is pending (after password verification to prevent account enumeration)
  if (userStatus === 'pending') {
    throw new AuthError(
      'Your account is pending admin approval. You will be notified once it is activated.',
      AuthErrorCode.ACCOUNT_PENDING,
      undefined,
      403
    );
  }

  // Generate tokens
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
    throw new AuthError(
      'Failed to generate authentication tokens',
      AuthErrorCode.INTERNAL_ERROR,
      undefined,
      500
    );
  }

  try {
    await storeRefreshToken(pool, user.id, refreshToken, expiresAt);
  } catch (storeError) {
    console.error('[auth] Failed to store refresh token:', storeError);
    // Don't fail login if refresh token storage fails - user can still login
  }

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
      status: userStatus
    }
  };

  // Record login event with comprehensive audit trail
  try {
    await recordLoginEvent(user.id, refreshToken, context);
  } catch (error) {
    // Log error but don't fail the login
    console.error('[auth] Failed to record login event:', error);
  }

  return response;
}

export async function refreshToken(token: string, context?: SessionContext): Promise<AuthResponse> {
  const pool = getPool();

  // Verify refresh token (this checks blacklist via verifyRefreshToken)
  let tokenInfo;
  try {
    tokenInfo = await verifyRefreshToken(pool, token);
  } catch (error) {
    // Token is invalid or blacklisted
    if (error instanceof Error && error.message.includes('Invalid refresh token')) {
      throw new AuthError(
        'Invalid or expired refresh token',
        AuthErrorCode.REFRESH_TOKEN_INVALID,
        undefined,
        401
      );
    }
    throw error;
  }

  const userResult = await pool.query(
    `SELECT id, email, role, tenant_id, is_verified, status FROM shared.users WHERE id = $1`,
    [tokenInfo.userId]
  );

  if (userResult.rowCount === 0) {
    throw new AuthError('User not found', AuthErrorCode.INTERNAL_ERROR, undefined, 500);
  }

  const user = userResult.rows[0] as DbUserRow;

  // Check user status
  const userStatus = (user.status as 'pending' | 'active' | 'suspended' | 'rejected') ?? 'pending';
  if (userStatus === 'suspended') {
    // Revoke token if user is suspended
    await revokeRefreshToken(pool, token);
    throw new AuthError(
      'Your account has been suspended',
      AuthErrorCode.ACCOUNT_SUSPENDED,
      undefined,
      403
    );
  }

  const payload = buildTokenPayload(user);
  const accessToken = generateAccessToken(payload);
  const { token: newRefreshToken, expiresAt } = generateRefreshToken(payload);

  // Revoke old token (blacklist it)
  await revokeRefreshToken(pool, token);
  // Store new refresh token
  await storeRefreshToken(pool, user.id, newRefreshToken, expiresAt);

  // Rotate session token for audit
  try {
    await rotateSessionToken(user.id, token, newRefreshToken, context);
  } catch (error) {
    console.error('[auth] Failed to rotate session token:', error);
    // Don't fail refresh if session rotation fails
  }

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
      status: userStatus
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

  // Send password reset email
  try {
    const resetUrl = `${process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173'}/auth/reset-password?token=${token}`;
    await emailService.sendPasswordReset({
      email: normalizedEmail,
      resetToken: token,
      resetUrl,
      expiresIn: '30 minutes'
    });
  } catch (emailError) {
    console.error('[auth] Failed to send password reset email:', emailError);
    // Don't fail the request if email fails - token is still generated
  }

  console.log(`[auth] Password reset token for ${normalizedEmail}: ${token}`);

  return { token };
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const pool = getPool();

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
    throw new AuthError('Invalid or expired token', AuthErrorCode.REFRESH_TOKEN_EXPIRED, undefined, 400);
  }

  const userId = result.rows[0].user_id;
  // Use secure password hashing
  const passwordHash = await hashPassword(newPassword);

  await pool.query(`UPDATE shared.users SET password_hash = $1 WHERE id = $2`, [
    passwordHash,
    userId
  ]);

  await pool.query(`DELETE FROM shared.password_reset_tokens WHERE token_hash = $1`, [tokenHash]);

  // Revoke all refresh tokens for this user (force re-login after password change)
  await pool.query(`DELETE FROM shared.refresh_tokens WHERE user_id = $1`, [userId]);
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
