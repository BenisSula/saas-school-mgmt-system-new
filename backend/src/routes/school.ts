import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import ensureTenantContext from '../middleware/ensureTenantContext';
import { requirePermission } from '../middleware/rbac';
import { schoolSchema } from '../validators/schoolValidator';
import { getSchool, upsertSchool } from '../services/schoolService';
import { createUpsertHandlers } from '../lib/routeHelpers';

const router = Router();

router.use(
  authenticate,
  tenantResolver(),
  ensureTenantContext(),
  requirePermission('users:manage')
);

const { getHandler, putHandler } = createUpsertHandlers({
  getResource: getSchool,
  upsertResource: upsertSchool,
  resourceName: 'School',
  auditAction: 'SCHOOL_SETTINGS_UPDATED',
  schema: schoolSchema
});

router.get('/', getHandler);
router.put('/', putHandler);

export default router;
