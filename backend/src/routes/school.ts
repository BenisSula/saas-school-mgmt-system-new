import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import ensureTenantContext from '../middleware/ensureTenantContext';
import { requirePermission } from '../middleware/rbac';
import { schoolSchema } from '../validators/schoolValidator';
import { getSchool, upsertSchool } from '../services/schoolService';

const router = Router();

router.use(
  authenticate,
  tenantResolver(),
  ensureTenantContext(),
  requirePermission('users:manage')
);

router.get('/', async (req, res, next) => {
  try {
    const school = await getSchool(req.tenantClient!, req.tenant!.schema);
    res.json(school ?? {});
  } catch (error) {
    next(error);
  }
});

router.put('/', async (req, res, next) => {
  const parsed = schoolSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.message });
  }

  try {
    const school = await upsertSchool(req.tenantClient!, req.tenant!.schema, parsed.data);
    res.json(school);
  } catch (error) {
    next(error);
  }
});

export default router;
