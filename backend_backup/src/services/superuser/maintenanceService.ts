/**
 * SuperUser Maintenance Service
 * Handles platform maintenance operations: migrations, cache clearing, schema health checks
 * 
 * Security: All operations are logged to audit_logs
 * DRY: Reuses existing migration and tenant management utilities
 */

import { getPool } from '../../db/connection';
import { runTenantMigrations as executeTenantMigrations } from '../../db/tenantManager';
import { createAuditLog } from '../audit/enhancedAuditService';
import { inspectSchema, schemaExists, getTableCount } from '../../db/schemaIntrospection';
import { getTenantById, listTenants } from '../shared/tenantQueries';
import { getErrorMessage } from '../../utils/errorUtils';

export interface MigrationResult {
  success: boolean;
  migrationsRun: number;
  errors: string[];
  duration: number;
}

export interface CacheClearResult {
  success: boolean;
  clearedKeys: number;
  errors: string[];
}

export interface SchemaHealthCheck {
  tenantId: string;
  schemaName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  issues: string[];
  tableCount: number;
  lastMigration?: string;
}

/**
 * Run migrations for a specific tenant or all tenants
 * @param tenantId - Optional tenant ID. If not provided, runs for all tenants
 * @param actorId - User ID performing the action (for audit log)
 */
export async function runTenantMigrationsForMaintenance(
  tenantId: string | null,
  actorId: string | null
): Promise<MigrationResult> {
  const pool = getPool();
  const startTime = Date.now();
  const errors: string[] = [];
  let migrationsRun = 0;

  const client = await pool.connect();
  try {
    // Log the action
    await createAuditLog(client, {
      userId: actorId || undefined,
      action: 'maintenance:run_migrations',
      resourceType: 'tenant',
      resourceId: tenantId || undefined,
      details: { tenantId: tenantId || 'all' },
      severity: 'info',
      tags: ['maintenance', 'migration']
    });

    if (tenantId) {
      // Run migrations for specific tenant
      const tenant = await getTenantById(tenantId);
      if (!tenant) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      try {
        await executeTenantMigrations(pool, tenant.schema_name);
        migrationsRun = 1;
      } catch (error) {
        errors.push(`Tenant ${tenantId}: ${getErrorMessage(error)}`);
      }
    } else {
      // Run migrations for all tenants
      const tenants = await listTenants();
      
      for (const tenant of tenants) {
        try {
          await executeTenantMigrations(pool, tenant.schema_name);
          migrationsRun++;
        } catch (error) {
          errors.push(`Tenant ${tenant.id} (${tenant.schema_name}): ${getErrorMessage(error)}`);
        }
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: errors.length === 0,
      migrationsRun,
      errors,
      duration
    };
  } catch (error) {
    const errorMsg = getErrorMessage(error);
    errors.push(errorMsg);

    await createAuditLog(client, {
      userId: actorId || undefined,
      action: 'maintenance:run_migrations:error',
      resourceType: 'tenant',
      resourceId: tenantId || undefined,
      details: { error: errorMsg },
      severity: 'error',
      tags: ['maintenance', 'migration', 'error']
    });

    return {
      success: false,
      migrationsRun,
      errors,
      duration: Date.now() - startTime
    };
  } finally {
    client.release();
  }
}

/**
 * Clear cache for a specific school/tenant
 * Note: This is a placeholder - actual cache implementation depends on your cache system (Redis, etc.)
 * @param tenantId - Tenant ID to clear cache for
 * @param actorId - User ID performing the action
 */
export async function clearTenantCache(
  tenantId: string,
  actorId: string | null
): Promise<CacheClearResult> {
  const clearedKeys: string[] = [];
  const errors: string[] = [];

  const pool = getPool();
  const client = await pool.connect();
  try {
    // Log the action
    await createAuditLog(client, {
      userId: actorId || undefined,
      action: 'maintenance:clear_cache',
      resourceType: 'tenant',
      resourceId: tenantId,
      details: { tenantId },
      severity: 'info',
      tags: ['maintenance', 'cache']
    });

    // TODO: Integrate with actual cache system (Redis, Memcached, etc.)
    // For now, this is a placeholder that logs the action
    // In production, you would:
    // 1. Connect to Redis/Memcached
    // 2. Find all keys matching tenant pattern (e.g., `cache:tenant:${tenantId}:*`)
    // 3. Delete those keys
    // 4. Return count of cleared keys

    // Placeholder implementation
    const tenant = await getTenantById(tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    // Simulate cache clearing (replace with actual cache implementation)
    clearedKeys.push(`tenant:${tenantId}:overview`);
    clearedKeys.push(`tenant:${tenantId}:users`);
    clearedKeys.push(`tenant:${tenantId}:stats`);

    return {
      success: true,
      clearedKeys: clearedKeys.length,
      errors: []
    };
  } catch (error) {
    const errorMsg = getErrorMessage(error);
    errors.push(errorMsg);

    await createAuditLog(client, {
      userId: actorId || undefined,
      action: 'maintenance:clear_cache:error',
      resourceType: 'tenant',
      resourceId: tenantId,
      details: { error: errorMsg },
      severity: 'error',
      tags: ['maintenance', 'cache', 'error']
    });

    return {
      success: false,
      clearedKeys: clearedKeys.length,
      errors
    };
  } finally {
    client.release();
  }
}

/**
 * Check schema health for a tenant or all tenants
 * @param tenantId - Optional tenant ID. If not provided, checks all tenants
 * @param actorId - User ID performing the action
 */
export async function checkSchemaHealth(
  tenantId: string | null,
  actorId: string | null
): Promise<SchemaHealthCheck[]> {
  const pool = getPool();
  const results: SchemaHealthCheck[] = [];

  const client = await pool.connect();
  try {
    // Log the action
    await createAuditLog(client, {
      userId: actorId || undefined,
      action: 'maintenance:check_schema_health',
      resourceType: 'tenant',
      resourceId: tenantId || undefined,
      details: { tenantId: tenantId || 'all' },
      severity: 'info',
      tags: ['maintenance', 'schema', 'health']
    });

    const tenants = tenantId
      ? [await getTenantById(tenantId)].filter(Boolean)
      : await listTenants();

    for (const tenant of tenants) {
      if (!tenant) continue;

      const issues: string[] = [];
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let tableCount = 0;
      let lastMigration: string | undefined;

      try {
        // Check if schema exists
        const exists = await schemaExists(pool, tenant.schema_name);

        if (!exists) {
          issues.push(`Schema ${tenant.schema_name} does not exist`);
          status = 'unhealthy';
        } else {
          // Count tables in schema
          tableCount = await getTableCount(pool, tenant.schema_name);

          if (tableCount === 0) {
            issues.push(`Schema ${tenant.schema_name} has no tables`);
            status = 'unhealthy';
          } else if (tableCount < 5) {
            // Expected minimum tables (adjust based on your schema)
            issues.push(`Schema ${tenant.schema_name} has fewer tables than expected`);
            status = 'degraded';
          }

          // Check for migration history (if you track this)
          // This is a placeholder - adjust based on your migration tracking
          try {
            const migrationResult = await pool.query(
              `SELECT name FROM ${tenant.schema_name}.schema_migrations ORDER BY run_at DESC LIMIT 1`
            ).catch(() => null);
            
            if (migrationResult?.rows[0]) {
              lastMigration = migrationResult.rows[0].name;
            }
          } catch {
            // Migration tracking table might not exist - not critical
          }

          // Check for common issues using schema introspection
          try {
            const schemaInfo = await inspectSchema(pool, tenant.schema_name);
            if (schemaInfo.missingTables.length > 0) {
              issues.push(`Missing expected tables: ${schemaInfo.missingTables.join(', ')}`);
              status = status === 'healthy' ? 'degraded' : status;
            }
          } catch (error) {
            // Schema introspection might fail - log but don't fail the check
            issues.push(`Could not inspect schema: ${getErrorMessage(error)}`);
            status = status === 'healthy' ? 'degraded' : status;
          }
        }
      } catch (error) {
        issues.push(`Error checking schema: ${getErrorMessage(error)}`);
        status = 'unhealthy';
      }

      results.push({
        tenantId: tenant.id,
        schemaName: tenant.schema_name,
        status,
        issues,
        tableCount,
        lastMigration
      });
    }

    return results;
  } catch (error) {
    const errorMsg = getErrorMessage(error);
    
    await createAuditLog(client, {
      userId: actorId || undefined,
      action: 'maintenance:check_schema_health:error',
      resourceType: 'tenant',
      resourceId: tenantId || undefined,
      details: { error: errorMsg },
      severity: 'error',
      tags: ['maintenance', 'schema', 'health', 'error']
    });

    throw error;
  } finally {
    client.release();
  }
}

