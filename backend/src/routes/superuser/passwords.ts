import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import authorizeSuperUser from '../../middleware/authorizeSuperUser';
import {
  adminResetPassword,
  adminForceChangePassword,
  getPasswordHistory,
} from '../../services/superuser/passwordManagementService';
import {
  passwordHistoryParamsSchema,
  passwordHistoryQuerySchema,
} from '../../validators/superuserPasswordValidator';
import {
  createPasswordResetHandler,
  createPasswordChangeHandler,
} from '../../lib/passwordRouteHelpers';
import type { Role } from '../../config/permissions';

const router = Router();

// All routes require authentication and superuser authorization
router.use(authenticate, authorizeSuperUser);

/**
 * POST /superuser/users/:userId/reset-password
 * Reset user password (generates temporary password)
 */
router.post(
  '/users/:userId/reset-password',
  createPasswordResetHandler({
    resetPassword: adminResetPassword,
  })
);

/**
 * POST /superuser/users/:userId/change-password
 * Force change user password
 */
router.post(
  '/users/:userId/change-password',
  createPasswordChangeHandler({
    changePassword: adminForceChangePassword,
  })
);

/**
 * GET /superuser/users/:userId/password-history
 * Get password change history for a user
 */
router.get('/users/:userId/password-history', async (req, res, next) => {
  try {
    const { getPool } = await import('../../db/connection');
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
      offset: queryResult.data.offset,
    };

    const result = await getPasswordHistory(pool, filters, req.user!.role as Role, req.user!.id);

    res.json(result);
      return;
  } catch (error) {
    next(error);

    return;
  }
});

export default router;
