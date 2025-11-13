import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import { requirePermission } from '../middleware/rbac';
import {
  createAdminForSchool,
  createSchool,
  getPlatformOverview,
  listSchools,
  softDeleteSchool,
  updateSchool
} from '../services/superuserService';
import {
  createAdminSchema,
  createSchoolSchema,
  updateSchoolSchema,
  sendAdminNotificationSchema
} from '../validators/superuserValidator';
import {
  listAllPlatformUsers,
  sendNotificationToAdmins
} from '../services/platformMonitoringService';

const router = Router();

router.use(authenticate, requirePermission('tenants:manage'));

router.get('/overview', async (req, res, next) => {
  try {
    const overview = await getPlatformOverview();
    res.json(overview);
  } catch (error) {
    next(error);
  }
});

router.get('/schools', async (req, res, next) => {
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
      return res.status(400).json({ message: parsed.error.message });
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
      return res.status(400).json({ message: parsed.error.message });
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
      return res.status(400).json({ message: parsed.error.message });
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
      actorId: req.user?.id ?? null
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
