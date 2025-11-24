import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/rbac';
import { getPool } from '../../db/connection';
import {
  createFeatureFlag,
  updateFeatureFlag,
  setTenantFeatureFlag,
  getAllFeatureFlags,
  getFeatureFlag,
  isFeatureEnabled,
} from '../../services/featureFlags/featureFlagService';
import { z } from 'zod';

const router = Router();

router.use(authenticate, requirePermission('tenants:manage'));

const createFeatureFlagSchema = z.object({
  flagKey: z.string().min(1).max(100),
  flagName: z.string().min(1),
  description: z.string().optional(),
  isEnabledGlobally: z.boolean().optional(),
  rolloutPercentage: z.number().int().min(0).max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateFeatureFlagSchema = z.object({
  flagName: z.string().optional(),
  description: z.string().optional(),
  isEnabledGlobally: z.boolean().optional(),
  rolloutPercentage: z.number().int().min(0).max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Create feature flag
router.post('/', async (req, res, next) => {
  try {
    const parsed = createFeatureFlagSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const flag = await createFeatureFlag(client, parsed.data, req.user?.id);
      res.status(201).json(flag);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Get all feature flags
router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const flags = await getAllFeatureFlags(client);
      res.json({ flags });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Get feature flag by key
router.get('/:flagKey', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const flag = await getFeatureFlag(client, req.params.flagKey);
      if (!flag) {
        return res.status(404).json({ message: 'Feature flag not found' });
      }
      res.json(flag);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Check if feature is enabled
router.get('/:flagKey/check', async (req, res, next) => {
  try {
    const tenantId = req.query.tenantId as string | undefined;
    const pool = getPool();
    const client = await pool.connect();
    try {
      const enabled = await isFeatureEnabled(client, req.params.flagKey, tenantId);
      res.json({ enabled, flagKey: req.params.flagKey, tenantId });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Update feature flag
router.patch('/:flagKey', async (req, res, next) => {
  try {
    const parsed = updateFeatureFlagSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const flag = await updateFeatureFlag(client, req.params.flagKey, parsed.data, req.user?.id);
      res.json(flag);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Set tenant-specific feature flag
router.post('/:flagKey/tenants/:tenantId', async (req, res, next) => {
  try {
    const schema = z.object({
      enabled: z.boolean(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await setTenantFeatureFlag(
        client,
        req.params.tenantId,
        req.params.flagKey,
        parsed.data.enabled,
        req.user?.id
      );
      res.json(result);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

export default router;
