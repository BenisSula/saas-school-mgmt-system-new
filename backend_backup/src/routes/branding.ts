import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import ensureTenantContext from '../middleware/ensureTenantContext';
import { requirePermission } from '../middleware/rbac';
import { brandingSchema } from '../validators/brandingValidator';
import { getBranding, upsertBranding } from '../services/brandingService';
import { createUpsertHandlers } from '../lib/routeHelpers';

const router = Router();

router.use(authenticate, tenantResolver(), ensureTenantContext(), requirePermission('settings:branding'));

const { getHandler, putHandler } = createUpsertHandlers({
  getResource: getBranding,
  upsertResource: upsertBranding,
  resourceName: 'Branding',
  auditAction: 'BRANDING_UPDATED',
  schema: brandingSchema
});

router.get('/', getHandler);
router.put('/', putHandler);

export default router;
