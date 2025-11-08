import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import { requirePermission } from '../middleware/rbac';
import { createTenant } from '../db/tenantManager';
import { tenantResolver } from '../middleware/tenantResolver';

const router = Router();

function createSchemaSlug(name: string): string {
  return `tenant_${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')}`;
}

router.post('/', authenticate, requirePermission('tenants:manage'), async (req, res) => {
  const { name, domain, schemaName } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Tenant name is required' });
  }

  const normalizedSchema = schemaName || createSchemaSlug(name);

  try {
    const tenant = await createTenant({
      name,
      domain,
      schemaName: normalizedSchema
    });

    return res.status(201).json({
      id: tenant.id,
      name,
      domain: domain ?? null,
      schemaName: normalizedSchema
    });
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
});

router.get(
  '/current/branding',
  authenticate,
  tenantResolver(),
  async (req, res) => {
    if (!req.tenantClient) {
      return res.status(500).json({ message: 'Tenant database client not available' });
    }

    const result = await req.tenantClient.query(
      `SELECT theme, logo_url, primary_color, updated_at FROM branding_settings ORDER BY updated_at DESC LIMIT 1`
    );

    return res.status(200).json({
      tenant: req.tenant,
      branding: result.rows[0] ?? null
    });
  }
);

export default router;

