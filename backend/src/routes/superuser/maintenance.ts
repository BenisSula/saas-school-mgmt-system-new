/**
 * SuperUser Maintenance Routes
 * Handles platform maintenance operations: migrations, cache clearing, schema health
 *
 * Security: All routes require superuser authentication
 * DRY: Reuses existing services and middleware
 */

import { Router } from 'express';
import { z } from 'zod';
import authenticate from '../../middleware/authenticate';
import { requireSuperuser } from '../../middleware/rbac';
import {
  runTenantMigrationsForMaintenance,
  clearTenantCache,
  checkSchemaHealth,
  type MigrationResult,
  type CacheClearResult,
  type SchemaHealthCheck,
} from '../../services/superuser/maintenanceService';

const router = Router();

// All routes require superuser authentication
router.use(authenticate, requireSuperuser());

const runMigrationsSchema = z.object({
  tenantId: z.string().uuid().nullable().optional(),
});

const clearCacheSchema = z.object({
  tenantId: z.string().uuid(),
});

const schemaHealthSchema = z.object({
  tenantId: z.string().uuid().nullable().optional(),
});

/**
 * POST /superuser/maintenance/run-migrations
 * Run migrations for a specific tenant or all tenants
 */
router.post('/run-migrations', async (req, res, next) => {
  try {
    const parsed = runMigrationsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid request body',
        errors: parsed.error.issues,
      });
    }

    const result: MigrationResult = await runTenantMigrationsForMaintenance(
      parsed.data.tenantId || null,
      req.user?.id || null
    );

    if (result.success) {
      res.json({
        success: true,
        message: `Successfully ran migrations for ${result.migrationsRun} tenant(s)`,
        data: result,
      });
      return;
    } else {
      res.status(207).json({
        // 207 Multi-Status for partial success
        success: false,
        message: `Migrations completed with errors for ${result.migrationsRun} tenant(s)`,
        data: result,
      });
      return;
    }
  } catch (error) {
    next(error);
    return;
  }
});

/**
 * POST /superuser/maintenance/clear-cache/:schoolId
 * Clear cache for a specific school/tenant
 */
router.post('/clear-cache/:schoolId', async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const parsed = clearCacheSchema.safeParse({ tenantId: schoolId });

    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid school ID',
        errors: parsed.error.issues,
      });
    }

    const result: CacheClearResult = await clearTenantCache(
      parsed.data.tenantId,
      req.user?.id || null
    );

    if (result.success) {
      res.json({
        success: true,
        message: `Successfully cleared ${result.clearedKeys} cache key(s)`,
        data: result,
      });
      return;
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to clear cache',
        data: result,
      });
      return;
    }
  } catch (error) {
    next(error);
    return;
  }
});

/**
 * GET /superuser/maintenance/schema-health
 * Check schema health for a tenant or all tenants
 */
router.get('/schema-health', async (req, res, next) => {
  try {
    const tenantId = req.query.tenantId as string | undefined;
    const parsed = schemaHealthSchema.safeParse({
      tenantId: tenantId || null,
    });

    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid query parameters',
        errors: parsed.error.issues,
      });
    }

    const results: SchemaHealthCheck[] = await checkSchemaHealth(
      parsed.data.tenantId || null,
      req.user?.id || null
    );

    res.json({
      success: true,
      data: results,
      summary: {
        total: results.length,
        healthy: results.filter((r) => r.status === 'healthy').length,
        degraded: results.filter((r) => r.status === 'degraded').length,
        unhealthy: results.filter((r) => r.status === 'unhealthy').length,
      },
    });
    return;
  } catch (error) {
    next(error);

    return;
  }
});

export default router;
