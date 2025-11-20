import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import { requirePermission } from '../middleware/rbac';
import { createSchemaSlug, createTenant } from '../db/tenantManager';
import { tenantResolver } from '../middleware/tenantResolver';
import { getPool } from '../db/connection';

const router = Router();

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

router.get('/current/branding', authenticate, tenantResolver(), async (req, res) => {
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
});

// Public endpoint for landing page - top schools
router.get('/top', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    const pool = getPool();
    
    // Query shared.tenants table for top schools
    // Note: logo_url is stored in tenant-specific branding_settings table, not in shared.tenants
    // For now, we return NULL for logo_url. If needed, we can join with branding_settings later.
    const result = await pool.query(
      `SELECT 
        id,
        name,
        NULL as logo_url,
        NULL as metric_label,
        NULL as metric_value,
        NULL as case_study_url
      FROM shared.tenants 
      WHERE status = 'active'
      ORDER BY created_at DESC 
      LIMIT $1`,
      [limit]
    );
    
    res.json(result.rows);
  } catch (error) {
    // Log the actual error for debugging
    console.error('[GET /schools/top] Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      message: 'Failed to fetch top schools',
      ...(process.env.NODE_ENV === 'development' && { error: errorMessage })
    });
  }
});

export default router;
