import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/rbac';
import { getPool } from '../../db/connection';
import { extractIpAddress, extractUserAgent } from '../../lib/superuserHelpers';
import { resetUserPassword, changeUserPassword } from '../../services/passwordResetService';
import { Role } from '../../config/permissions';
import { z } from 'zod';

const router = Router();

// All routes require authentication and admin permission
router.use(authenticate, requirePermission('users:manage'));

const resetPasswordParamsSchema = z.object({
  userId: z.string().uuid()
});

const resetPasswordBodySchema = z.object({
  reason: z.string().optional()
});

const changePasswordParamsSchema = z.object({
  userId: z.string().uuid()
});

const changePasswordBodySchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  reason: z.string().optional()
});

/**
 * POST /admin/users/:userId/reset-password
 * Admin-initiated password reset (generates temporary password)
 * Admin can reset passwords for teachers, hods, and students in their tenant
 */
router.post('/users/:userId/reset-password', async (req, res, next) => {
  try {
    const pool = getPool();
    const paramsResult = resetPasswordParamsSchema.safeParse(req.params);
    
    if (!paramsResult.success) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const bodyResult = resetPasswordBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({ message: bodyResult.error.message });
    }

    const { userId } = paramsResult.data;
    const { reason } = bodyResult.data;

    const ipAddress = extractIpAddress(req);
    const userAgent = extractUserAgent(req);

    const result = await resetUserPassword(
      pool,
      userId,
      req.user!.id,
      req.user!.role as Role,
      ipAddress,
      userAgent,
      reason
    );

    res.json({
      message: 'Password reset successfully',
      temporaryPassword: result.temporaryPassword
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/users/:userId/change-password
 * Admin-initiated password change (sets new password directly)
 * Admin can change passwords for teachers, hods, and students in their tenant
 */
router.post('/users/:userId/change-password', async (req, res, next) => {
  try {
    const pool = getPool();
    const paramsResult = changePasswordParamsSchema.safeParse(req.params);
    
    if (!paramsResult.success) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const bodyResult = changePasswordBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({ message: bodyResult.error.message });
    }

    const { userId } = paramsResult.data;
    const { newPassword, reason } = bodyResult.data;

    const ipAddress = extractIpAddress(req);
    const userAgent = extractUserAgent(req);

    await changeUserPassword(
      pool,
      userId,
      newPassword,
      req.user!.id,
      req.user!.role as Role,
      ipAddress,
      userAgent,
      reason
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;

