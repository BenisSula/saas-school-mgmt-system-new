import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/rbac';
import { getPool } from '../../db/connection';
import {
  createInvitation,
  acceptInvitation,
  getOnboardingProgress,
  initializeOnboardingWizard,
  updateOnboardingWizard,
  completeTenantOnboarding,
} from '../../services/onboarding/onboardingService';
import { z } from 'zod';

const router = Router();

router.use(authenticate, requirePermission('tenants:manage'));

const createInvitationSchema = z.object({
  tenantId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['admin', 'teacher', 'student']),
  expiresInHours: z.number().int().min(1).max(168).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Create invitation
router.post('/invitations', async (req, res, next) => {
  try {
    const parsed = createInvitationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await createInvitation(client, {
        ...parsed.data,
        invitedBy: req.user?.id || '',
      });
      res.status(201).json(result);

      return;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

// Accept invitation (public endpoint, no auth required)
router.post('/invitations/:id/accept', async (req, res, next) => {
  try {
    const schema = z.object({
      token: z.string(),
      password: z.string().min(8),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await acceptInvitation(
        client,
        req.params.id,
        parsed.data.token,
        parsed.data.password
      );
      res.json(result);

      return;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

// Get onboarding progress
router.get('/progress/:tenantId', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const progress = await getOnboardingProgress(client, req.params.tenantId);
      res.json(progress);

      return;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

// Initialize onboarding wizard
router.post('/wizard/:tenantId/initialize', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const wizard = await initializeOnboardingWizard(client, req.params.tenantId);
      res.json(wizard);

      return;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

// Update onboarding wizard
router.patch('/wizard/:tenantId', async (req, res, next) => {
  try {
    const schema = z.object({
      currentStep: z.number().int().positive().optional(),
      completedSteps: z.array(z.number().int()).optional(),
      wizardData: z.record(z.string(), z.unknown()).optional(),
      isCompleted: z.boolean().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const wizard = await updateOnboardingWizard(client, req.params.tenantId, parsed.data);
      res.json(wizard);

      return;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

// Complete onboarding
router.post('/complete/:tenantId', async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string(),
      address: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().email().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      await completeTenantOnboarding(client, req.params.tenantId, parsed.data);
      res.json({ success: true });

      return;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

export default router;
