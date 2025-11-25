import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import { requireSuperuser } from '../middleware/rbac';
import {
  createAdminForSchool,
  createSchool,
  getPlatformOverview,
  getTenantAnalytics,
  getUsageMonitoring,
  listSchools,
  softDeleteSchool,
  updateSchool,
} from '../services/superuserService';
import {
  createAdminSchema,
  createSchoolSchema,
  updateSchoolSchema,
  sendAdminNotificationSchema,
} from '../validators/superuserValidator';
import {
  listAllPlatformUsers,
  sendNotificationToAdmins,
} from '../services/platformMonitoringService';
import billingRouter from './superuser/billing';
import onboardingRouter from './superuser/onboarding';
import featureFlagsRouter from './superuser/featureFlags';
import reportsRouter from './superuser/reports';
import dataManagementRouter from './superuser/dataManagement';
import sessionsRouter from './superuser/sessions';
import passwordsRouter from './superuser/passwords';
import auditRouter from './superuser/audit';
import investigationsRouter from './superuser/investigations';
import subscriptionsRouter from './superuser/subscriptions';
import overridesRouter from './superuser/overrides';
import permissionOverridesRouter from './superuser/permissionOverrides';
import schoolsRouter from './superuser/schools';
import usersRouter from './superuser/users';
import rolesRouter from './superuser/roles';
import maintenanceRouter from './superuser/maintenance';

const router = Router();

// Apply superuser middleware to all routes
router.use(authenticate, requireSuperuser());

router.get('/overview', async (_req, res, next) => {
  try {
    const overview = await getPlatformOverview();
    res.json(overview);
  } catch (error) {
    next(error);
  }
});

router.get('/schools', async (_req, res, next) => {
  try {
    const schools = await listSchools();
    res.json(schools);
  } catch (error) {
    next(error);
  }
});

router.post('/schools', async (req, res, next) => {
  try {
    const parsed = createSchoolSchema.safeParse(req.body);
    if (!parsed.success) {
      const { formatValidationErrors } = await import('../lib/validationHelpers');
      return res.status(400).json({
        message: formatValidationErrors(parsed.error),
        errors: parsed.error.issues,
      });
    }
    const school = await createSchool(parsed.data, req.user?.id ?? null);
    res.status(201).json(school);
  } catch (error) {
    next(error);
  }
});

router.patch('/schools/:id', async (req, res, next) => {
  try {
    const parsed = updateSchoolSchema.safeParse(req.body);
    if (!parsed.success) {
      const { formatValidationErrors } = await import('../lib/validationHelpers');
      return res.status(400).json({
        message: formatValidationErrors(parsed.error),
        errors: parsed.error.issues,
      });
    }
    const updated = await updateSchool(req.params.id, parsed.data, req.user?.id ?? null);
    if (!updated) {
      return res.status(404).json({ message: 'School not found' });
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete('/schools/:id', async (req, res, next) => {
  try {
    await softDeleteSchool(req.params.id, req.user?.id ?? null);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post('/schools/:id/admins', async (req, res, next) => {
  try {
    const parsed = createAdminSchema.safeParse(req.body);
    if (!parsed.success) {
      const { formatValidationErrors } = await import('../lib/validationHelpers');
      return res.status(400).json({
        message: formatValidationErrors(parsed.error),
        errors: parsed.error.issues,
      });
    }
    const admin = await createAdminForSchool(req.params.id, parsed.data, req.user?.id ?? null);
    res.status(201).json(admin);
  } catch (error) {
    next(error);
  }
});

router.get('/users', async (_req, res, next) => {
  try {
    const users = await listAllPlatformUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
});

router.post('/notifications', async (req, res, next) => {
  try {
    const parsed = sendAdminNotificationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    const result = await sendNotificationToAdmins({
      ...parsed.data,
      actorId: req.user?.id ?? null,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/analytics/tenant/:tenantId', async (req, res, next) => {
  try {
    const analytics = await getTenantAnalytics(req.params.tenantId);
    res.json(analytics);
  } catch (error) {
    next(error);
  }
});

router.get('/usage', async (req, res, next) => {
  try {
    const tenantId = req.query.tenantId as string | undefined;
    const usage = tenantId ? await getUsageMonitoring(tenantId) : await getUsageMonitoring();
    res.json(usage);
  } catch (error) {
    next(error);
  }
});

router.patch('/users/:userId/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status || !['pending', 'active', 'suspended', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Valid status is required' });
    }
    const { updatePlatformUserStatus } = await import('../services/platformMonitoringService');
    const updated = await updatePlatformUserStatus(req.params.userId, status, req.user?.id ?? null);
    if (!updated) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post('/reports', async (req, res, next) => {
  try {
    const { type } = req.body;
    if (!type || !['audit', 'users', 'revenue', 'activity'].includes(type)) {
      return res.status(400).json({ message: 'Valid report type is required' });
    }
    const { generatePlatformReport } = await import('../services/platformMonitoringService');
    const result = await generatePlatformReport(type, req.user?.id ?? null);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.put('/settings', async (req, res, next) => {
  try {
    const { updatePlatformSettings } = await import('../services/platformMonitoringService');
    await updatePlatformSettings(req.body, req.user?.id ?? null);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Billing routes
router.use('/billing', billingRouter);

// Onboarding routes
router.use('/onboarding', onboardingRouter);

// Feature flags routes
router.use('/feature-flags', featureFlagsRouter);

// Reports routes
router.use('/reports', reportsRouter);

// Data Management routes
router.use('/data', dataManagementRouter);

// Session management routes
router.use('/', sessionsRouter);

// Password management routes
router.use('/', passwordsRouter);

// Audit log routes
router.use('/', auditRouter);

// Investigation routes
router.use('/investigations', investigationsRouter);

// Subscription routes
router.use('/subscriptions', subscriptionsRouter);

// Override routes
router.use('/overrides', overridesRouter);

// Permission override routes
router.use('/permission-overrides', permissionOverridesRouter);

// School-specific routes
router.use('/schools', schoolsRouter);

// User-specific routes
router.use('/users', usersRouter);

// Role management routes
router.use('/roles', rolesRouter);

// Maintenance routes
router.use('/maintenance', maintenanceRouter);

// PUT /superuser/subscription-tiers - Alias for subscription tier config update
router.put('/subscription-tiers', async (req, res, next) => {
  try {
    const { updateSubscriptionTierConfigs } = await import(
      '../services/superuser/subscriptionTierService'
    );
    const { z } = await import('zod');

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
