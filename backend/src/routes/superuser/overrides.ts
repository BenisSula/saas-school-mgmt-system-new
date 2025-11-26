import { Router } from 'express';
import { z } from 'zod';
import {
  createOverride,
  getOverrideById,
  listOverrides,
  revokeOverride,
  getActiveOverridesForTarget,
  type OverrideType,
} from '../../services/superuser/overrideService';

const router = Router();

const createOverrideSchema = z.object({
  overrideType: z.enum([
    'user_status',
    'tenant_status',
    'subscription_limit',
    'feature_access',
    'quota_override',
    'rate_limit',
    'other',
  ]),
  targetId: z.string().uuid(),
  action: z.string().min(1),
  reason: z.string().min(1),
  expiresAt: z
    .string()
    .refine((val) => val === undefined || !isNaN(Date.parse(val)), {
      message: 'Invalid datetime format',
    })
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Create override
router.post('/', async (req, res, next) => {
  try {
    const parsed = createOverrideSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthenticated' });
    }

    const input = {
      ...parsed.data,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
    };

    const override = await createOverride(input, req.user.id);
    res.status(201).json(override);
      return;
  } catch (error) {
    next(error);

    return;
  }
});

// List overrides
router.get('/', async (req, res, next) => {
  try {
    const filters: {
      overrideType?: OverrideType;
      targetId?: string;
      isActive?: boolean;
      createdBy?: string;
    } = {};

    if (req.query.overrideType) {
      filters.overrideType = req.query.overrideType as OverrideType;
    }
    if (req.query.targetId) {
      filters.targetId = req.query.targetId as string;
    }
    if (req.query.isActive !== undefined) {
      filters.isActive = req.query.isActive === 'true';
    }
    if (req.query.createdBy) {
      filters.createdBy = req.query.createdBy as string;
    }

    const overrides = await listOverrides(filters);
    res.json(overrides);
      return;
  } catch (error) {
    next(error);

    return;
  }
});

// Get override by ID
router.get('/:id', async (req, res, next) => {
  try {
    const override = await getOverrideById(req.params.id);
    if (!override) {
      return res.status(404).json({ message: 'Override not found' });
    }
    res.json(override);
      return;
  } catch (error) {
    next(error);

    return;
  }
});

// Get active overrides for target
router.get('/target/:overrideType/:targetId', async (req, res, next) => {
  try {
    // Validate overrideType matches the expected OverrideType enum
    const validOverrideTypes: Array<OverrideType> = [
      'user_status',
      'tenant_status',
      'subscription_limit',
      'feature_access',
      'quota_override',
      'rate_limit',
      'other',
    ];

    if (!validOverrideTypes.includes(req.params.overrideType as OverrideType)) {
      return res.status(400).json({
        message: `Invalid override type. Must be one of: ${validOverrideTypes.join(', ')}`,
      });
    }

    const overrides = await getActiveOverridesForTarget(
      req.params.overrideType as OverrideType,
      req.params.targetId
    );
    res.json(overrides);
      return;
  } catch (error) {
    next(error);

    return;
  }
});

// Revoke override
router.post('/:id/revoke', async (req, res, next) => {
  try {
    const override = await revokeOverride(req.params.id, req.body.reason, req.user?.id ?? null);
    res.json(override);
      return;
  } catch (error) {
    next(error);

    return;
  }
});

export default router;
