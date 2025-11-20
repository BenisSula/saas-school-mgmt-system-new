import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import ensureTenantContext from '../middleware/ensureTenantContext';
import { requirePermission } from '../middleware/rbac';
import { getPool } from '../db/connection';

const router = Router();

router.use(authenticate, tenantResolver(), ensureTenantContext());

/**
 * GET /departments
 * List all departments for the current tenant
 * Departments are stored in shared.departments and linked to shared.schools via school_id
 */
router.get('/', requirePermission('users:manage'), async (req, res, next) => {
  try {
    if (!req.user || !req.tenant) {
      return res.status(500).json({ message: 'User or tenant context missing' });
    }

    const pool = getPool();
    
    // Find the school for this tenant from shared.schools
    // shared.schools has tenant_id column
    const schoolResult = await pool.query(
      `
        SELECT id 
        FROM shared.schools
        WHERE tenant_id = $1
        LIMIT 1
      `,
      [req.tenant.id]
    );

    if (schoolResult.rowCount === 0) {
      return res.json([]); // No school, return empty array
    }

    const schoolId = schoolResult.rows[0].id;

    // Query departments for this school
    const departmentsResult = await pool.query(
      `
        SELECT id, name, slug, contact_email, contact_phone
        FROM shared.departments
        WHERE school_id = $1
        ORDER BY name ASC
      `,
      [schoolId]
    );

    res.json(departmentsResult.rows);
  } catch (error) {
    console.error('[departments] Error listing departments:', error);
    next(error);
  }
});

export default router;

