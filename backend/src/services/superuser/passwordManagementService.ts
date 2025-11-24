import argon2 from 'argon2';
// crypto not used in this file but may be needed for future implementations
import type { Pool } from 'pg';
// PoolClient type not used in this file but may be needed for future implementations
import { requireSuperuser, isSuperuser } from '../../lib/superuserHelpers';
import { Role } from '../../config/permissions';
import { createAuditLog } from '../audit/enhancedAuditService';
import { queueEmail } from '../email/emailService';
import { normalizeDeviceInfo } from '../../lib/serializers/deviceInfoSerializer';

export interface PasswordChangeHistory {
  id: string;
  userId: string;
  tenantId: string | null;
  changedBy: string | null;
  changedByEmail?: string | null;
  changedByName?: string | null;
  changedByRole?: string | null;
  changeType: 'self_reset' | 'admin_reset' | 'admin_change' | 'forced_reset';
  ipAddress: string | null;
  userAgent: string | null;
  deviceInfo?: {
    platform?: string;
    os?: string;
    browser?: string;
    deviceType?: 'mobile' | 'tablet' | 'desktop';
    raw?: string;
  };
  changedAt: Date;
  metadata: Record<string, unknown>;
}

export interface PasswordHistoryFilters {
  userId?: string;
  tenantId?: string | null;
  changeType?: 'self_reset' | 'admin_reset' | 'admin_change' | 'forced_reset';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Admin-initiated password reset
 * Generates a new password and forces user to change it on next login
 */
export async function adminResetPassword(
  pool: Pool,
  userId: string,
  adminUserId: string,
  adminRole: Role,
  ipAddress?: string | null,
  userAgent?: string | null,
  reason?: string,
  skipSuperuserCheck = false
): Promise<{ temporaryPassword: string }> {
  // Allow skipping superuser check for admin users (when called from passwordResetService)
  if (!skipSuperuserCheck) {
    requireSuperuser(adminRole);
  }

  // Verify user exists and get user info in one query
  const userResult = await pool.query(
    `SELECT id, email, role, tenant_id FROM shared.users WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new Error('User not found');
  }

  const user = userResult.rows[0];
  const tenantId = user.tenant_id || null;

  // Generate a secure, user-friendly temporary password
  // Format: 12 characters with mix of uppercase, lowercase, numbers
  // Excludes confusing characters (0, O, 1, I, l) for better usability
  const generateSecurePassword = (): string => {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude O, I
    const lowercase = 'abcdefghijkmnopqrstuvwxyz'; // Exclude l, o
    const numbers = '23456789'; // Exclude 0, 1
    const allChars = uppercase + lowercase + numbers;

    let password = '';
    // Ensure at least one of each type for security
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];

    // Fill the rest randomly (total 12 characters)
    for (let i = password.length; i < 12; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password to randomize character positions
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  };

  const temporaryPassword = generateSecurePassword();

  // Ensure password is a clean string (no whitespace issues)
  const cleanPassword = temporaryPassword.trim();

  // Use argon2.hash with default options (argon2 stores options in hash, verify will work automatically)
  // This ensures compatibility with login verification
  const passwordHash = await argon2.hash(cleanPassword);

  // Update user password (works for all user types: student, teacher, admin, superadmin, hod)
  // Ensure password_hash is updated correctly and user can login immediately
  const updateResult = await pool.query(
    `
      UPDATE shared.users
      SET password_hash = $1
      WHERE id = $2
      RETURNING id, email, password_hash
    `,
    [passwordHash, userId]
  );

  if (updateResult.rows.length === 0) {
    throw new Error('Failed to update user password');
  }

  // Verify the password was set correctly by checking it can be verified
  // This ensures the hash is valid and will work for login
  // Use the stored hash from database to verify (in case of any encoding issues)
  const storedHash = updateResult.rows[0].password_hash;
  try {
    const verifyTest = await argon2.verify(storedHash, cleanPassword);
    if (!verifyTest) {
      console.error(
        '[passwordManagementService] Password verification test failed for user:',
        updateResult.rows[0].email
      );
      throw new Error('Password hash verification failed - password may not work for login');
    }
  } catch (verifyError) {
    console.error('[passwordManagementService] Password verification test failed:', verifyError);
    throw new Error('Password hash is invalid - cannot verify temporary password');
  }

  // Record password change history (with error handling if table doesn't exist)
  try {
    await pool.query(
      `
        INSERT INTO shared.password_change_history (
          user_id, tenant_id, changed_by, change_type,
          ip_address, user_agent, metadata
        )
        VALUES ($1, $2, $3, 'admin_reset', $4, $5, $6::jsonb)
      `,
      [
        userId,
        tenantId,
        adminUserId,
        ipAddress || null,
        userAgent || null,
        JSON.stringify({ reason: reason || null, temporaryPassword: true }),
      ]
    );
  } catch (historyError: unknown) {
    // If table doesn't exist, log warning but don't fail the password reset
    const errorMessage =
      historyError instanceof Error ? historyError.message : String(historyError);
    if (errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
      console.warn(
        '[passwordManagementService] Password change history table not found. Please run migration 016_password_change_history.sql'
      );
    } else {
      // Re-throw other errors
      throw historyError;
    }
  }

  // Get user email for notification
  const userEmailResult = await pool.query(`SELECT email FROM shared.users WHERE id = $1`, [
    userId,
  ]);
  const userEmail = userEmailResult.rows[0]?.email;

  // Audit log - get a client from pool
  const client = await pool.connect();
  try {
    await createAuditLog(client, {
      tenantId: undefined, // Platform-level action
      userId: adminUserId,
      action: 'ADMIN_PASSWORD_RESET',
      resourceType: 'USER',
      resourceId: userId,
      details: {
        targetUserId: userId,
        targetUserEmail: userEmail,
        reason: reason || undefined,
      },
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      severity: 'critical',
      tags: ['password_reset', 'security'],
    });

    // Send email notification to affected user
    if (userEmail) {
      try {
        await queueEmail(client, {
          tenantId: tenantId || undefined,
          templateKey: 'password_reset_notification',
          recipientEmail: userEmail,
          variables: {
            temporaryPassword: cleanPassword,
            reason: reason || 'Administrative password reset',
            resetBy: adminUserId,
            resetAt: new Date().toISOString(),
          },
          priority: 1, // High priority
        });
      } catch (emailError) {
        // Log email error but don't fail the password reset
        console.error(
          '[passwordManagementService] Failed to send password reset notification:',
          emailError
        );
      }
    }
  } finally {
    client.release();
  }

  // Return the clean password (not the original temporaryPassword to ensure consistency)
  return { temporaryPassword: cleanPassword };
}

/**
 * Admin-initiated password change
 * Sets a new password directly (user doesn't need to change it)
 */
export async function adminForceChangePassword(
  pool: Pool,
  userId: string,
  newPassword: string,
  adminUserId: string,
  adminRole: Role,
  ipAddress?: string | null,
  userAgent?: string | null,
  reason?: string,
  skipSuperuserCheck = false
): Promise<void> {
  // Allow skipping superuser check for admin users (when called from passwordResetService)
  if (!skipSuperuserCheck) {
    requireSuperuser(adminRole);
  }

  // Validate password strength (basic check)
  if (newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  // Verify user exists and get user info in one query
  const userResult = await pool.query(
    `SELECT id, email, role, tenant_id FROM shared.users WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new Error('User not found');
  }

  const user = userResult.rows[0];
  const tenantId = user.tenant_id || null;

  // Ensure password is a clean string (no whitespace issues)
  const cleanPassword = newPassword.trim();

  // Use argon2.hash with default options (argon2 stores options in hash, verify will work automatically)
  // This ensures compatibility with login verification which uses default options
  const passwordHash = await argon2.hash(cleanPassword);

  // Update user password (works for all user types: student, teacher, admin, superadmin, hod)
  // Ensure password_hash is updated correctly and user can login immediately
  const updateResult = await pool.query(
    `
      UPDATE shared.users
      SET password_hash = $1
      WHERE id = $2
      RETURNING id, email, password_hash
    `,
    [passwordHash, userId]
  );

  if (updateResult.rows.length === 0) {
    throw new Error('Failed to update user password');
  }

  // Verify the password was set correctly by checking it can be verified
  // This ensures the hash is valid and will work for login
  // Use the stored hash from database to verify (in case of any encoding issues)
  const storedHash = updateResult.rows[0].password_hash;
  try {
    const verifyTest = await argon2.verify(storedHash, cleanPassword);
    if (!verifyTest) {
      console.error(
        '[passwordManagementService] Password verification test failed for user:',
        updateResult.rows[0].email
      );
      throw new Error('Password hash verification failed - password may not work for login');
    }
  } catch (verifyError) {
    console.error('[passwordManagementService] Password verification test failed:', verifyError);
    throw new Error('Password hash is invalid - cannot verify new password');
  }

  // Record password change history (with error handling if table doesn't exist)
  try {
    await pool.query(
      `
        INSERT INTO shared.password_change_history (
          user_id, tenant_id, changed_by, change_type,
          ip_address, user_agent, metadata
        )
        VALUES ($1, $2, $3, 'admin_change', $4, $5, $6::jsonb)
      `,
      [
        userId,
        tenantId,
        adminUserId,
        ipAddress || null,
        userAgent || null,
        JSON.stringify({ reason: reason || undefined }),
      ]
    );
  } catch (historyError: unknown) {
    // If table doesn't exist, log warning but don't fail the password change
    const errorMessage =
      historyError instanceof Error ? historyError.message : String(historyError);
    if (errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
      console.warn(
        '[passwordManagementService] Password change history table not found. Please run migration 016_password_change_history.sql'
      );
    } else {
      // Re-throw other errors
      throw historyError;
    }
  }

  // Get user email for notification
  const userEmailResult = await pool.query(`SELECT email FROM shared.users WHERE id = $1`, [
    userId,
  ]);
  const userEmail = userEmailResult.rows[0]?.email;

  // Audit log - get a client from pool
  const client = await pool.connect();
  try {
    await createAuditLog(client, {
      tenantId: undefined, // Platform-level action
      userId: adminUserId,
      action: 'ADMIN_PASSWORD_CHANGE',
      resourceType: 'USER',
      resourceId: userId,
      details: {
        targetUserId: userId,
        targetUserEmail: userEmail,
        reason: reason || null,
      },
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      severity: 'critical',
      tags: ['password_change', 'security'],
    });

    // Send email notification to affected user
    if (userEmail) {
      try {
        await queueEmail(client, {
          tenantId: tenantId || undefined,
          templateKey: 'password_change_notification',
          recipientEmail: userEmail,
          variables: {
            reason: reason || 'Administrative password change',
            changedBy: adminUserId,
            changedAt: new Date().toISOString(),
          },
          priority: 1, // High priority
        });
      } catch (emailError) {
        // Log email error but don't fail the password change
        console.error(
          '[passwordManagementService] Failed to send password change notification:',
          emailError
        );
      }
    }
  } finally {
    client.release();
  }
}

/**
 * Get password change history for a user
 * Superusers can query any user, regular users can only query themselves
 */
export async function getPasswordHistory(
  pool: Pool,
  filters: PasswordHistoryFilters,
  requesterRole: Role,
  requesterUserId?: string
): Promise<{ history: PasswordChangeHistory[]; total: number }> {
  // Non-superusers can only view their own password history
  if (filters.userId && !isSuperuser(requesterRole) && requesterUserId !== filters.userId) {
    throw new Error('Unauthorized: You can only view your own password history');
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

  if (filters.changeType) {
    conditions.push(`change_type = $${paramIndex++}`);
    values.push(filters.changeType);
  }

  if (filters.startDate) {
    conditions.push(`changed_at >= $${paramIndex++}`);
    values.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push(`changed_at <= $${paramIndex++}`);
    values.push(filters.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count (with error handling if table doesn't exist)
  let total = 0;
  try {
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM shared.password_change_history ${whereClause}`,
      values
    );
    total = parseInt(countResult.rows[0].total, 10);
  } catch (countError: unknown) {
    const errorMessage = countError instanceof Error ? countError.message : String(countError);
    if (errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
      // Table doesn't exist, return empty history
      return { history: [], total: 0 };
    }
    throw countError;
  }

  // Get history (with error handling if table doesn't exist)
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  const limitValues = [...values, limit, offset];

  try {
    // Include JOIN to resolve changed_by to user email/name
    const historyResult = await pool.query(
      `
        SELECT 
          pch.id, pch.user_id, pch.tenant_id, pch.changed_by, pch.change_type,
          pch.ip_address, pch.user_agent, pch.changed_at, pch.metadata,
          changed_by_user.email as changed_by_email,
          changed_by_user.full_name as changed_by_name,
          changed_by_user.role as changed_by_role
        FROM shared.password_change_history pch
        LEFT JOIN shared.users changed_by_user ON pch.changed_by = changed_by_user.id
        ${whereClause}
        ORDER BY pch.changed_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex}
      `,
      limitValues
    );

    return {
      history: historyResult.rows.map(mapRowToHistory),
      total,
    };
  } catch (historyError: unknown) {
    const errorMessage =
      historyError instanceof Error ? historyError.message : String(historyError);
    if (errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
      // Table doesn't exist, return empty history
      return { history: [], total: 0 };
    }
    throw historyError;
  }
}

/**
 * Map database row to PasswordChangeHistory type
 */
function mapRowToHistory(row: {
  id: string;
  user_id: string;
  tenant_id: string | null;
  changed_by: string | null;
  change_type: string;
  ip_address: string | null;
  user_agent: string | null;
  changed_at: Date;
  metadata: unknown;
  changed_by_email?: string | null;
  changed_by_name?: string | null;
  changed_by_role?: string | null;
}): PasswordChangeHistory {
  // Normalize device info from userAgent
  const deviceInfo = normalizeDeviceInfo(null, row.user_agent);

  return {
    id: row.id,
    userId: row.user_id,
    tenantId: row.tenant_id,
    changedBy: row.changed_by,
    changedByEmail: row.changed_by_email || null,
    changedByName: row.changed_by_name || null,
    changedByRole: row.changed_by_role || null,
    changeType: row.change_type as PasswordChangeHistory['changeType'],
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    deviceInfo,
    changedAt: row.changed_at,
    metadata: (row.metadata as Record<string, unknown>) || {},
  };
}
