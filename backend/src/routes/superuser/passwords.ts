import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import authorizeSuperUser from '../../middleware/authorizeSuperUser';
import { getPool } from '../../db/connection';
import { extractIpAddress, extractUserAgent } from '../../lib/superuserHelpers';
import {
  adminResetPassword,
  adminForceChangePassword,
  getPasswordHistory
} from '../../services/superuser/passwordManagementService';
import {
  resetPasswordParamsSchema,
  resetPasswordBodySchema,
  changePasswordParamsSchema,
  changePasswordBodySchema,
  passwordHistoryParamsSchema,
  passwordHistoryQuerySchema
} from '../../validators/superuserPasswordValidator';
import { Role } from '../../config/permissions';

const router = Router();

// All routes require authentication and superuser authorization
router.use(authenticate, authorizeSuperUser);

/**
 * POST /superuser/users/:userId/reset-password
 * Reset user password (generates temporary password)
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

    const result = await adminResetPassword(
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
 * POST /superuser/users/:userId/change-password
 * Force change user password
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

    await adminForceChangePassword(
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

/**
 * GET /superuser/users/:userId/password-history
 * Get password change history for a user
 */
router.get('/users/:userId/password-history', async (req, res, next) => {
  try {
    const pool = getPool();
    const paramsResult = passwordHistoryParamsSchema.safeParse(req.params);
    
    if (!paramsResult.success) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const queryResult = passwordHistoryQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({ message: queryResult.error.message });
    }

    const { userId } = paramsResult.data;

    const filters = {
      userId,
      tenantId: queryResult.data.tenantId,
      changeType: queryResult.data.changeType,
      startDate: queryResult.data.startDate,
      endDate: queryResult.data.endDate,
      limit: queryResult.data.limit,
      offset: queryResult.data.offset
    };

    const result = await getPasswordHistory(
      pool,
      filters,
      req.user!.role as Role,
      req.user!.id
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;

