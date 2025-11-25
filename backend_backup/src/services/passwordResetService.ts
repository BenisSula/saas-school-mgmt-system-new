import { Pool } from 'pg';
import { Role } from '../config/permissions';
import { adminResetPassword, adminForceChangePassword } from './superuser/passwordManagementService';

/**
 * Check if a role can reset password for another role
 * - Superadmin can reset all users (including admin)
 * - Admin can reset teachers, hods, and students (but not admin or superadmin)
 */
export function canResetPasswordFor(requesterRole: Role, targetRole: Role): boolean {
  // Superadmin can reset anyone
  if (requesterRole === 'superadmin') {
    return true;
  }

  // Admin can reset teachers, hods, and students
  if (requesterRole === 'admin') {
    return ['teacher', 'hod', 'student'].includes(targetRole);
  }

  // Others cannot reset passwords
  return false;
}

/**
 * Role-based password reset
 * Respects permissions: superadmin can reset all, admin can reset teachers/hods/students
 */
export async function resetUserPassword(
  pool: Pool,
  targetUserId: string,
  requesterUserId: string,
  requesterRole: Role,
  ipAddress?: string | null,
  userAgent?: string | null,
  reason?: string
): Promise<{ temporaryPassword: string }> {
  // Get target user info to check role
  const targetUserResult = await pool.query(
    `SELECT id, email, role FROM shared.users WHERE id = $1`,
    [targetUserId]
  );

  if (targetUserResult.rows.length === 0) {
    throw new Error('User not found');
  }

  const targetUser = targetUserResult.rows[0];
  const targetRole = targetUser.role as Role;

  // Check permissions
  if (!canResetPasswordFor(requesterRole, targetRole)) {
    throw new Error(`You do not have permission to reset password for ${targetRole} users`);
  }

  // For superadmin, use superuser service directly
  if (requesterRole === 'superadmin') {
    return await adminResetPassword(
      pool,
      targetUserId,
      requesterUserId,
      requesterRole,
      ipAddress,
      userAgent,
      reason
    );
  }

  // For admin, check if they can reset this user
  // Admin can only reset users in their tenant
  const requesterResult = await pool.query(
    `SELECT tenant_id FROM shared.users WHERE id = $1`,
    [requesterUserId]
  );

  if (requesterResult.rows.length === 0) {
    throw new Error('Requester not found');
  }

  const requesterTenantId = requesterResult.rows[0].tenant_id;
  const targetTenantId = targetUser.tenant_id;

  // Admin can only reset users in their tenant
  if (requesterTenantId !== targetTenantId) {
    throw new Error('You can only reset passwords for users in your organization');
  }

  // Use superuser service with skipSuperuserCheck flag for admin users
  // We've already validated permissions, so we can bypass the superuser check
  return await adminResetPassword(
    pool,
    targetUserId,
    requesterUserId,
    requesterRole,
    ipAddress,
    userAgent,
    reason,
    requesterRole === 'admin' // Skip superuser check for admin
  );
}

/**
 * Role-based password change
 * Respects permissions: superadmin can change all, admin can change teachers/hods/students
 */
export async function changeUserPassword(
  pool: Pool,
  targetUserId: string,
  newPassword: string,
  requesterUserId: string,
  requesterRole: Role,
  ipAddress?: string | null,
  userAgent?: string | null,
  reason?: string
): Promise<void> {
  // Get target user info to check role
  const targetUserResult = await pool.query(
    `SELECT id, email, role, tenant_id FROM shared.users WHERE id = $1`,
    [targetUserId]
  );

  if (targetUserResult.rows.length === 0) {
    throw new Error('User not found');
  }

  const targetUser = targetUserResult.rows[0];
  const targetRole = targetUser.role as Role;

  // Check permissions
  if (!canResetPasswordFor(requesterRole, targetRole)) {
    throw new Error(`You do not have permission to change password for ${targetRole} users`);
  }

  // For admin, check if they can change this user (must be in same tenant)
  if (requesterRole === 'admin') {
    const requesterResult = await pool.query(
      `SELECT tenant_id FROM shared.users WHERE id = $1`,
      [requesterUserId]
    );

    if (requesterResult.rows.length === 0) {
      throw new Error('Requester not found');
    }

    const requesterTenantId = requesterResult.rows[0].tenant_id;
    const targetTenantId = targetUser.tenant_id;

    if (requesterTenantId !== targetTenantId) {
      throw new Error('You can only change passwords for users in your organization');
    }
  }

  // Use superuser service with skipSuperuserCheck flag for admin users
  // We've already validated permissions, so we can bypass the superuser check
  return await adminForceChangePassword(
    pool,
    targetUserId,
    newPassword,
    requesterUserId,
    requesterRole,
    ipAddress,
    userAgent,
    reason,
    requesterRole === 'admin' // Skip superuser check for admin
  );
}

