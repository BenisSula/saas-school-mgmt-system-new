import { Router } from 'express';
import { z } from 'zod';
import {
  createSubscription,
  getSubscriptionByTenantId,
  getSubscriptionById,
  updateSubscription,
  suspendSubscription,
  cancelSubscription,
  listSubscriptions,
  getSubscriptionHistory,
} from '../../services/superuser/subscriptionService';
import {
  getSubscriptionTierConfigs,
  updateSubscriptionTierConfigs,
} from '../../services/superuser/subscriptionTierService';

const router = Router();

const createSubscriptionSchema = z.object({
  tenantId: z.string().uuid(),
  tier: z.enum(['free', 'trial', 'paid']),
  status: z.enum(['active', 'suspended', 'cancelled', 'expired']).optional(),
  billingPeriod: z.enum(['monthly', 'yearly', 'quarterly', 'annually']).optional(),
  currentPeriodStart: z
    .string()
    .refine((val) => val === undefined || !isNaN(Date.parse(val)), {
      message: 'Invalid datetime format',
    })
    .optional(),
  currentPeriodEnd: z
    .string()
    .refine((val) => val === undefined || !isNaN(Date.parse(val)), {
      message: 'Invalid datetime format',
    })
    .optional(),
  trialEndDate: z
    .string()
    .refine((val) => val === undefined || !isNaN(Date.parse(val)), {
      message: 'Invalid datetime format',
    })
    .optional(),
  customLimits: z.record(z.string(), z.unknown()).optional(),
});

const updateSubscriptionSchema = z.object({
  tier: z.enum(['free', 'trial', 'paid']).optional(),
  status: z.enum(['active', 'suspended', 'cancelled', 'expired']).optional(),
  billingPeriod: z.enum(['monthly', 'yearly', 'quarterly', 'annually']).optional(),
  currentPeriodStart: z
    .string()
    .refine((val) => val === undefined || !isNaN(Date.parse(val)), {
      message: 'Invalid datetime format',
    })
    .optional(),
  currentPeriodEnd: z
    .string()
    .refine((val) => val === undefined || !isNaN(Date.parse(val)), {
      message: 'Invalid datetime format',
    })
    .optional(),
  trialEndDate: z
    .string()
    .refine((val) => val === undefined || !isNaN(Date.parse(val)), {
      message: 'Invalid datetime format',
    })
    .optional(),
  customLimits: z.record(z.string(), z.unknown()).optional(),
});

// Create subscription
router.post('/', async (req, res, next) => {
  try {
    const parsed = createSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const input = {
      ...parsed.data,
      currentPeriodStart: parsed.data.currentPeriodStart
        ? new Date(parsed.data.currentPeriodStart)
        : undefined,
      currentPeriodEnd: parsed.data.currentPeriodEnd
        ? new Date(parsed.data.currentPeriodEnd)
        : undefined,
      trialEndDate: parsed.data.trialEndDate ? new Date(parsed.data.trialEndDate) : undefined,
    };

    const subscription = await createSubscription(input, req.user?.id ?? null);
    res.status(201).json(subscription);
  } catch (error) {
    next(error);
  }
});

// List subscriptions
router.get('/', async (req, res, next) => {
  try {
    const filters: {
      tier?: 'free' | 'trial' | 'paid';
      status?: 'active' | 'suspended' | 'cancelled' | 'expired';
      tenantId?: string;
    } = {};

    if (req.query.tier) {
      filters.tier = req.query.tier as 'free' | 'trial' | 'paid';
    }
    if (req.query.status) {
      filters.status = req.query.status as 'active' | 'suspended' | 'cancelled' | 'expired';
    }
    if (req.query.tenantId) {
      filters.tenantId = req.query.tenantId as string;
    }

    const subscriptions = await listSubscriptions(filters);
    res.json(subscriptions);
  } catch (error) {
    next(error);
  }
});

// Get subscription by ID
router.get('/:id', async (req, res, next) => {
  try {
    const subscription = await getSubscriptionById(req.params.id);
    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }
    res.json(subscription);
  } catch (error) {
    next(error);
  }
});

// Get subscription by tenant ID
router.get('/tenant/:tenantId', async (req, res, next) => {
  try {
    const subscription = await getSubscriptionByTenantId(req.params.tenantId);
    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }
    res.json(subscription);
  } catch (error) {
    next(error);
  }
});

// Update subscription
router.patch('/:id', async (req, res, next) => {
  try {
    const parsed = updateSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const input = {
      ...parsed.data,
      currentPeriodStart: parsed.data.currentPeriodStart
        ? new Date(parsed.data.currentPeriodStart)
        : undefined,
      currentPeriodEnd: parsed.data.currentPeriodEnd
        ? new Date(parsed.data.currentPeriodEnd)
        : undefined,
      trialEndDate: parsed.data.trialEndDate ? new Date(parsed.data.trialEndDate) : undefined,
    };

    const subscription = await updateSubscription(req.params.id, input, req.user?.id ?? null);
    res.json(subscription);
  } catch (error) {
    next(error);
  }
});

// Suspend subscription
router.post('/:id/suspend', async (req, res, next) => {
  try {
    const subscription = await suspendSubscription(
      req.params.id,
      req.body.reason,
      req.user?.id ?? null
    );
    res.json(subscription);
  } catch (error) {
    next(error);
  }
});

// Cancel subscription
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const subscription = await cancelSubscription(
      req.params.id,
      req.body.reason,
      req.user?.id ?? null
    );
    res.json(subscription);
  } catch (error) {
    next(error);
  }
});

// Get subscription history
router.get('/:id/history', async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const history = await getSubscriptionHistory(req.params.id, limit);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

// Get subscription tier configurations
router.get('/tiers/config', async (req, res, next) => {
  try {
    const configs = await getSubscriptionTierConfigs();
    res.json(configs);
  } catch (error) {
    next(error);
  }
});

// Update subscription tier configurations (bulk)
const updateTierConfigsSchema = z.object({
  configs: z
    .array(
      z.object({
        tier: z.enum(['free', 'trial', 'paid']),
        config: z.object({
          name: z.string().optional(),
          description: z.string().optional(),
          monthlyPrice: z.number().optional(),
          yearlyPrice: z.number().optional(),
          maxUsers: z.number().nullable().optional(),
          maxStudents: z.number().nullable().optional(),
          maxTeachers: z.number().nullable().optional(),
          maxStorageGb: z.number().nullable().optional(),
          features: z.record(z.string(), z.unknown()).optional(),
          limits: z.record(z.string(), z.unknown()).optional(),
          isActive: z.boolean().optional(),
        }),
      })
    )
    .min(1, 'At least one tier configuration is required'),
});

router.put('/tiers/config', async (req, res, next) => {
  try {
    const parsed = updateTierConfigsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const updated = await updateSubscriptionTierConfigs(parsed.data.configs, req.user?.id ?? null);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
