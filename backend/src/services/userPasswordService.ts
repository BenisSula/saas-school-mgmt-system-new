import argon2 from 'argon2';
import { Pool } from 'pg';
import { createAuditLog } from './audit/enhancedAuditService';
import { normalizeDeviceInfo } from '../lib/serializers/deviceInfoSerializer';

/**
 * User-initiated password change (from profile page)
 * Requires current password verification
 */
export async function changeOwnPassword(
  pool: Pool,
  userId: string,
  currentPassword: string,
  newPassword: string,
  ipAddress?: string | null,
  userAgent?: string | null
): Promise<void> {
  // Validate password strength
  if (newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  // Get user and verify current password
  const userResult = await pool.query(
    `SELECT id, email, password_hash, tenant_id FROM shared.users WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new Error('User not found');
  }

  const user = userResult.rows[0];
  const tenantId = user.tenant_id || null;

  // Verify current password
  try {
    const passwordValid = await argon2.verify(user.password_hash, currentPassword);
    if (!passwordValid) {
      throw new Error('Current password is incorrect');
    }
  } catch (verifyError) {
    if (verifyError instanceof Error && verifyError.message === 'Current password is incorrect') {
      throw verifyError;
    }
    throw new Error('Invalid current password');
  }

  // Ensure new password is clean
  const cleanPassword = newPassword.trim();
  
  // Hash new password
  const passwordHash = await argon2.hash(cleanPassword);

  // Update password
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
    throw new Error('Failed to update password');
  }

  // Verify the password was set correctly
  const storedHash = updateResult.rows[0].password_hash;
  try {
    const verifyTest = await argon2.verify(storedHash, cleanPassword);
    if (!verifyTest) {
      throw new Error('Password hash verification failed');
    }
  } catch (verifyError) {
    console.error('[userPasswordService] Password verification test failed:', verifyError);
    throw new Error('Password hash is invalid');
  }

  // Record password change history
  try {
    const deviceInfo = normalizeDeviceInfo(null, userAgent || null);
    await pool.query(
      `
        INSERT INTO shared.password_change_history (
          user_id, tenant_id, changed_by, change_type,
          ip_address, user_agent, metadata
        )
        VALUES ($1, $2, $3, 'self_reset', $4, $5, $6::jsonb)
      `,
      [
        userId,
        tenantId,
        userId, // Changed by self
        ipAddress || null,
        userAgent || null,
        JSON.stringify({ deviceInfo })
      ]
    );
  } catch (historyError: unknown) {
    // If table doesn't exist, log warning but don't fail the password change
    const errorMessage = historyError instanceof Error ? historyError.message : String(historyError);
    if (errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
      console.warn('[userPasswordService] Password change history table not found. Please run migration 016_password_change_history.sql');
    } else {
      // Re-throw other errors
      throw historyError;
    }
  }

  // Audit log
  const client = await pool.connect();
  try {
    await createAuditLog(client, {
      tenantId: tenantId || undefined,
      userId: userId,
      action: 'USER_PASSWORD_CHANGE',
      resourceType: 'USER',
      resourceId: userId,
      details: {
        changedBy: userId,
        changedByEmail: user.email
      },
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      severity: 'info',
      tags: ['password_change', 'security']
    });
  } finally {
    client.release();
  }
}

