import { Router } from 'express';
import { z } from 'zod';
import {
  grantPermissionOverride,
  revokePermissionOverride,
  getPermissionOverridesForUser,
  listPermissionOverrides
} from '../../services/superuser/permissionOverrideService';
import { Permission } from '../../config/permissions';

const router = Router();

const grantPermissionOverrideSchema = z.object({
  userId: z.string().uuid(),
  permission: z.string() as z.ZodType<Permission>,
  reason: z.string().optional(),
  expiresAt: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid datetime format' }).optional()
});

const revokePermissionOverrideSchema = z.object({
  userId: z.string().uuid(),
  permission: z.string() as z.ZodType<Permission>,
  reason: z.string().optional()
});

// Grant permission override
router.post('/grant', async (req, res, next) => {
  try {
    const parsed = grantPermissionOverrideSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthenticated' });
    }

    const input = {
      ...parsed.data,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined
    };

    const override = await grantPermissionOverride(input, req.user.id);
    res.status(201).json(override);
  } catch (error) {
    next(error);
  }
});

// Revoke permission override
router.post('/revoke', async (req, res, next) => {
  try {
    const parsed = revokePermissionOverrideSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthenticated' });
    }

    await revokePermissionOverride(parsed.data, req.user.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// List permission overrides
router.get('/', async (req, res, next) => {
  try {
    const filters: {
      userId?: string;
      permission?: Permission;
      grantedBy?: string;
    } = {};

    if (req.query.userId) {
      filters.userId = req.query.userId as string;
    }
    if (req.query.permission) {
      filters.permission = req.query.permission as Permission;
    }
    if (req.query.grantedBy) {
      filters.grantedBy = req.query.grantedBy as string;
    }

    const overrides = await listPermissionOverrides(filters);
    res.json(overrides);
  } catch (error) {
    next(error);
  }
});

// Get permission overrides for user
router.get('/user/:userId', async (req, res, next) => {
  try {
    const overrides = await getPermissionOverridesForUser(req.params.userId);
    res.json(overrides);
  } catch (error) {
    next(error);
  }
});

export default router;

