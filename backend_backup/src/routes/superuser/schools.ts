import { Router } from 'express';
import { z } from 'zod';
import authenticate from '../../middleware/authenticate';
import { requireSuperuser } from '../../middleware/rbac';
import { getSchoolById } from '../../services/superuserService';
import {
  getSubscriptionByTenantId,
  updateSubscription,
  getSubscriptionHistory
} from '../../services/superuser/subscriptionService';
import {
  listOverrides,
  createOverride,
  revokeOverride
} from '../../services/superuser/overrideService';
import { getPlatformAuditLogs } from '../../services/superuser/platformAuditService';
import { getPool } from '../../db/connection';
import { Role } from '../../config/permissions';

const router = Router();

// All routes require superuser authentication
router.use(authenticate, requireSuperuser());

const subscriptionUpdateSchema = z.object({
  tier: z.enum(['free', 'trial', 'paid']).optional(),
  status: z.enum(['active', 'suspended', 'cancelled', 'expired']).optional(),
  billingPeriod: z.enum(['monthly', 'yearly', 'quarterly', 'annually']).optional(),
  currentPeriodStart: z.string().datetime({ message: 'Invalid datetime format' }).optional(),
  currentPeriodEnd: z.string().datetime({ message: 'Invalid datetime format' }).optional(),
  trialEndDate: z.string().datetime({ message: 'Invalid datetime format' }).optional(),
  customLimits: z.record(z.string(), z.unknown()).optional()
});

const overrideCreateSchema = z.object({
  action: z.string().min(1),
  reason: z.string().min(1),
  expiresAt: z.string().refine((val) => val === undefined || val === null || !isNaN(Date.parse(val)), { message: 'Invalid datetime format' }).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

/**
 * GET /superuser/schools/:id
 * Get school details including subscription
 */
router.get('/:id', async (req, res, next) => {
  try {
    const school = await getSchoolById(req.params.id);
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }
    
    const subscription = await getSubscriptionByTenantId(school.id);
    
    res.json({
      ...school,
      subscription
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /superuser/schools/:id/subscription
 * Update school subscription
 */
router.patch('/:id/subscription', async (req, res, next) => {
  try {
    const school = await getSchoolById(req.params.id);
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }
    
    const existingSubscription = await getSubscriptionByTenantId(school.id);
    if (!existingSubscription) {
      return res.status(404).json({ message: 'Subscription not found for this school' });
    }
    
    const parsed = subscriptionUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    
    const subscription = await updateSubscription(
      existingSubscription.id,
      {
        tier: parsed.data.tier,
        status: parsed.data.status,
        billingPeriod: parsed.data.billingPeriod,
        currentPeriodStart: parsed.data.currentPeriodStart ? new Date(parsed.data.currentPeriodStart) : undefined,
        currentPeriodEnd: parsed.data.currentPeriodEnd ? new Date(parsed.data.currentPeriodEnd) : undefined,
        trialEndDate: parsed.data.trialEndDate ? new Date(parsed.data.trialEndDate) : undefined,
        customLimits: parsed.data.customLimits
      },
      req.user?.id ?? null
    );
    
    res.json(subscription);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /superuser/schools/:id/subscription/history
 * Get subscription history
 */
router.get('/:id/subscription/history', async (req, res, next) => {
  try {
    const school = await getSchoolById(req.params.id);
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }
    
    const subscription = await getSubscriptionByTenantId(school.id);
    if (!subscription) {
      return res.json([]);
    }
    
    const history = await getSubscriptionHistory(subscription.id);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /superuser/schools/:id/audit-logs
 * Get school-level audit logs
 */
router.get('/:id/audit-logs', async (req, res, next) => {
  try {
    const school = await getSchoolById(req.params.id);
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }
    
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      const filters = {
        tenantId: school.id,
        userId: req.query.userId as string | undefined,
        action: req.query.action as string | undefined,
        resourceType: req.query.resourceType as string | undefined,
        resourceId: req.query.resourceId as string | undefined,
        severity: req.query.severity as 'info' | 'warning' | 'error' | 'critical' | undefined,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0
      };
      
      const result = await getPlatformAuditLogs(
        client,
        filters,
        (req.user?.role ?? 'superadmin') as Role
      );
      
      res.json(result);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /superuser/schools/:id/overrides
 * Create manual override for school
 */
router.post('/:id/overrides', async (req, res, next) => {
  try {
    const school = await getSchoolById(req.params.id);
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }
    
    const parsed = overrideCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    
    const override = await createOverride(
      {
        overrideType: 'tenant_status',
        targetId: school.id,
        action: parsed.data.action,
        reason: parsed.data.reason,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
        metadata: parsed.data.metadata
      },
      req.user?.id ?? ''
    );
    
    res.status(201).json(override);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /superuser/schools/:id/overrides
 * List overrides for school
 */
router.get('/:id/overrides', async (req, res, next) => {
  try {
    const school = await getSchoolById(req.params.id);
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }
    
    const isActive = req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined;
    const overrides = await listOverrides({
      overrideType: 'tenant_status',
      targetId: school.id,
      isActive
    });
    
    res.json(overrides);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /superuser/schools/:id/overrides/:overrideId
 * Revoke override
 */
router.delete('/:id/overrides/:overrideId', async (req, res, next) => {
  try {
    await revokeOverride(req.params.overrideId, req.user?.id ?? '');
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

