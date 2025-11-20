import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import { getTenantPreparationStatus } from '../services/tenantPreparationService';
import { getPool } from '../db/connection';

const router = Router();

/**
 * GET /tenant-status/:tenantId
 * Get tenant preparation status
 * Public endpoint (no auth required) - used during signup
 */
router.get('/:tenantId', async (req, res, next) => {
  try {
    const { tenantId } = req.params;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const status = await getTenantPreparationStatus(tenantId);

    if (!status) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    res.json(status);
  } catch (error) {
    console.error('[tenantStatus] Error getting tenant status:', error);
    next(error);
  }
});

/**
 * GET /tenant-status
 * Get current user's tenant preparation status
 * Requires authentication
 */
router.get('/', authenticate, tenantResolver({ optional: true }), async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const tenantId = req.user.tenantId || req.query.tenantId as string;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    // Verify user has access to this tenant
    if (req.user.role !== 'superadmin' && req.user.tenantId !== tenantId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const status = await getTenantPreparationStatus(tenantId);

    if (!status) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    res.json(status);
  } catch (error) {
    console.error('[tenantStatus] Error getting tenant status:', error);
    next(error);
  }
});

export default router;

