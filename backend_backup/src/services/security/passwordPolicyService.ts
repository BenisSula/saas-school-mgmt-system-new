import type { PoolClient } from 'pg';
// z from zod not used in this file but may be needed for future implementations

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxAgeDays?: number;
  preventReuseCount: number;
  lockoutAttempts: number;
  lockoutDurationMinutes: number;
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Get password policy for a tenant (or platform default)
 */
export async function getPasswordPolicy(
  client: PoolClient,
  tenantId?: string
): Promise<PasswordPolicy> {
  const result = await client.query(
    `
      SELECT * FROM shared.password_policies
      WHERE tenant_id = $1 OR (tenant_id IS NULL AND $1 IS NULL)
      ORDER BY tenant_id NULLS LAST
      LIMIT 1
    `,
    [tenantId || null]
  );

  if (result.rowCount === 0) {
    // Return default policy
    return {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: false,
      maxAgeDays: 90,
      preventReuseCount: 5,
      lockoutAttempts: 5,
      lockoutDurationMinutes: 30
    };
  }

  const policy = result.rows[0];
  return {
    minLength: policy.min_length,
    requireUppercase: policy.require_uppercase,
    requireLowercase: policy.require_lowercase,
    requireNumbers: policy.require_numbers,
    requireSpecialChars: policy.require_special_chars,
    maxAgeDays: policy.max_age_days,
    preventReuseCount: policy.prevent_reuse_count,
    lockoutAttempts: policy.lockout_attempts,
    lockoutDurationMinutes: policy.lockout_duration_minutes
  };
}

/**
 * Validate password against policy
 */
export function validatePassword(
  password: string,
  policy: PasswordPolicy
): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters long`);
  }

  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (policy.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Check if password was recently used (prevent reuse)
 */
export async function isPasswordReused(
  client: PoolClient,
  userId: string,
  passwordHash: string,
  preventReuseCount: number
): Promise<boolean> {
  const result = await client.query(
    `
      SELECT password_hash
      FROM shared.password_history
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, preventReuseCount]
  );

  return result.rows.some((row) => row.password_hash === passwordHash);
}

/**
 * Record password in history
 */
export async function recordPasswordHistory(
  client: PoolClient,
  userId: string,
  passwordHash: string
): Promise<void> {
  await client.query(
    `
      INSERT INTO shared.password_history (user_id, password_hash)
      VALUES ($1, $2)
    `,
    [userId, passwordHash]
  );

  // Clean up old passwords beyond prevent_reuse_count
  const policyResult = await client.query(
    `
      SELECT prevent_reuse_count
      FROM shared.password_policies
      WHERE tenant_id = (SELECT tenant_id FROM shared.users WHERE id = $1)
         OR tenant_id IS NULL
      ORDER BY tenant_id NULLS LAST
      LIMIT 1
    `,
    [userId]
  );

  const preventReuseCount = policyResult.rows[0]?.prevent_reuse_count || 5;

  await client.query(
    `
      DELETE FROM shared.password_history
      WHERE user_id = $1
      AND id NOT IN (
        SELECT id FROM shared.password_history
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      )
    `,
    [userId, preventReuseCount]
  );
}

/**
 * Check if account is locked
 */
export async function isAccountLocked(
  client: PoolClient,
  userId: string
): Promise<{ locked: boolean; lockedUntil?: Date }> {
  const result = await client.query(
    `
      SELECT locked_until
      FROM shared.account_lockouts
      WHERE user_id = $1 AND locked_until > NOW()
    `,
    [userId]
  );

  if (result.rowCount === 0) {
    return { locked: false };
  }

  return {
    locked: true,
    lockedUntil: result.rows[0].locked_until
  };
}

/**
 * Record failed login attempt and lock account if threshold reached
 */
export async function recordFailedLoginAttempt(
  client: PoolClient,
  email: string,
  userId?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ locked: boolean; remainingAttempts: number }> {
  // Record attempt
  await client.query(
    `
      INSERT INTO shared.failed_login_attempts (user_id, email, ip_address, user_agent)
      VALUES ($1, $2, $3, $4)
    `,
    [userId || null, email, ipAddress || null, userAgent || null]
  );

  if (!userId) {
    return { locked: false, remainingAttempts: 0 };
  }

  // Get policy
  const policyResult = await client.query(
    `
      SELECT lockout_attempts, lockout_duration_minutes
      FROM shared.password_policies
      WHERE tenant_id = (SELECT tenant_id FROM shared.users WHERE id = $1)
         OR tenant_id IS NULL
      ORDER BY tenant_id NULLS LAST
      LIMIT 1
    `,
    [userId]
  );

  const lockoutAttempts = policyResult.rows[0]?.lockout_attempts || 5;
  const lockoutDurationMinutes = policyResult.rows[0]?.lockout_duration_minutes || 30;

  // Count recent failed attempts
  const attemptsResult = await client.query(
    `
      SELECT COUNT(*) as count
      FROM shared.failed_login_attempts
      WHERE user_id = $1
      AND created_at > NOW() - INTERVAL '15 minutes'
    `,
    [userId]
  );

  const attemptCount = parseInt(attemptsResult.rows[0].count, 10);
  const remainingAttempts = Math.max(0, lockoutAttempts - attemptCount);

  if (attemptCount >= lockoutAttempts) {
    // Lock account
    const lockedUntil = new Date();
    lockedUntil.setMinutes(lockedUntil.getMinutes() + lockoutDurationMinutes);

    await client.query(
      `
        INSERT INTO shared.account_lockouts (user_id, locked_until, reason)
        VALUES ($1, $2, 'Too many failed login attempts')
        ON CONFLICT (user_id)
        DO UPDATE SET locked_until = EXCLUDED.locked_until, reason = EXCLUDED.reason
      `,
      [userId, lockedUntil]
    );

    return { locked: true, remainingAttempts: 0 };
  }

  return { locked: false, remainingAttempts };
}

/**
 * Clear failed login attempts (on successful login)
 */
export async function clearFailedLoginAttempts(client: PoolClient, userId: string): Promise<void> {
  await client.query('DELETE FROM shared.failed_login_attempts WHERE user_id = $1', [userId]);

  // Remove lockout if exists
  await client.query('DELETE FROM shared.account_lockouts WHERE user_id = $1', [userId]);
}

/**
 * Update password policy for a tenant
 */
export async function updatePasswordPolicy(
  client: PoolClient,
  tenantId: string | null,
  policy: Partial<PasswordPolicy>
): Promise<unknown> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (policy.minLength !== undefined) {
    updates.push(`min_length = $${paramIndex++}`);
    values.push(policy.minLength);
  }
  if (policy.requireUppercase !== undefined) {
    updates.push(`require_uppercase = $${paramIndex++}`);
    values.push(policy.requireUppercase);
  }
  if (policy.requireLowercase !== undefined) {
    updates.push(`require_lowercase = $${paramIndex++}`);
    values.push(policy.requireLowercase);
  }
  if (policy.requireNumbers !== undefined) {
    updates.push(`require_numbers = $${paramIndex++}`);
    values.push(policy.requireNumbers);
  }
  if (policy.requireSpecialChars !== undefined) {
    updates.push(`require_special_chars = $${paramIndex++}`);
    values.push(policy.requireSpecialChars);
  }
  if (policy.maxAgeDays !== undefined) {
    updates.push(`max_age_days = $${paramIndex++}`);
    values.push(policy.maxAgeDays);
  }
  if (policy.preventReuseCount !== undefined) {
    updates.push(`prevent_reuse_count = $${paramIndex++}`);
    values.push(policy.preventReuseCount);
  }
  if (policy.lockoutAttempts !== undefined) {
    updates.push(`lockout_attempts = $${paramIndex++}`);
    values.push(policy.lockoutAttempts);
  }
  if (policy.lockoutDurationMinutes !== undefined) {
    updates.push(`lockout_duration_minutes = $${paramIndex++}`);
    values.push(policy.lockoutDurationMinutes);
  }

  if (updates.length === 0) {
    throw new Error('No updates provided');
  }

  updates.push(`updated_at = NOW()`);
  values.push(tenantId);

  const result = await client.query(
    `
      INSERT INTO shared.password_policies (
        tenant_id, min_length, require_uppercase, require_lowercase,
        require_numbers, require_special_chars, max_age_days,
        prevent_reuse_count, lockout_attempts, lockout_duration_minutes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (tenant_id)
      DO UPDATE SET ${updates.join(', ')}
      RETURNING *
    `,
    [
      tenantId,
      policy.minLength ?? 8,
      policy.requireUppercase ?? true,
      policy.requireLowercase ?? true,
      policy.requireNumbers ?? true,
      policy.requireSpecialChars ?? false,
      policy.maxAgeDays ?? null,
      policy.preventReuseCount ?? 5,
      policy.lockoutAttempts ?? 5,
      policy.lockoutDurationMinutes ?? 30,
      ...values
    ]
  );

  return result.rows[0];
}
