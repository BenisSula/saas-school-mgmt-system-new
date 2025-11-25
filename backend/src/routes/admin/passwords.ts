import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/rbac';
import { resetUserPassword, changeUserPassword } from '../../services/passwordResetService';
import {
  createPasswordResetHandler,
  createPasswordChangeHandler,
} from '../../lib/passwordRouteHelpers';

const router = Router();

// All routes require authentication and admin permission
router.use(authenticate, requirePermission('users:manage'));

/**
 * POST /admin/users/:userId/reset-password
 * Admin-initiated password reset (generates temporary password)
 * Admin can reset passwords for teachers, hods, and students in their tenant
 */
router.post(
  '/users/:userId/reset-password',
  createPasswordResetHandler({
    resetPassword: resetUserPassword,
  })
);

/**
 * POST /admin/users/:userId/change-password
 * Admin-initiated password change (sets new password directly)
 * Admin can change passwords for teachers, hods, and students in their tenant
 */
router.post(
  '/users/:userId/change-password',
  createPasswordChangeHandler({
    changePassword: changeUserPassword,
  })
);

export default router;
