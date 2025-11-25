/**
 * Admin Overview Routes
 * Provides aggregated overview data for admin dashboard
 */

import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import tenantResolver from '../../middleware/tenantResolver';
import { requirePermission } from '../../middleware/rbac';
import { getAdminOverview } from '../../services/adminOverviewService';
import { createSuccessResponse, createErrorResponse } from '../../lib/responseHelpers';
import { logger } from '../../services/monitoring/loggingService';

const router = Router();

/**
 * GET /admin/overview
 * Get comprehensive admin overview data
 */
router.get(
  '/',
  authenticate,
  tenantResolver(),
  requirePermission('dashboard:view'),
  async (req, res, next) => {
    try {
      if (!req.tenant?.schema) {
        return res.status(400).json(createErrorResponse('Tenant context required'));
      }

      const overview = await getAdminOverview(req.tenant.id, req.tenant.schema);

      logger.info('Admin overview data retrieved', {
        requestId: req.requestId,
        tenantId: req.tenant.id,
        userId: req.user?.id,
      });

      res.json(createSuccessResponse(overview, 'Overview data retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }
);

export default router;
