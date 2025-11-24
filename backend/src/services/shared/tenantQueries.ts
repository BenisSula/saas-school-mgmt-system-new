/**
 * Shared Tenant Query Utilities
 * Centralized tenant query functions to avoid duplication across services
 *
 * DRY: All tenant queries should use these utilities instead of duplicating SQL
 */

import { getPool } from '../../db/connection';

export interface TenantBasicInfo {
  id: string;
  name: string;
  schema_name: string;
  status: string;
  subscription_type: string;
}

/**
 * Get basic tenant information by ID
 * @param tenantId - Tenant UUID
 * @returns Tenant basic info or null if not found
 */
export async function getTenantById(tenantId: string): Promise<TenantBasicInfo | null> {
  const pool = getPool();
  const result = await pool.query<TenantBasicInfo>(
    `SELECT id, name, schema_name, status, subscription_type 
     FROM shared.tenants 
     WHERE id = $1`,
    [tenantId]
  );
  return result.rows[0] || null;
}

/**
 * List all tenants with basic information
 * @param includeInactive - Whether to include inactive tenants (default: true)
 * @returns Array of tenant basic info
 */
export async function listTenants(includeInactive: boolean = true): Promise<TenantBasicInfo[]> {
  const pool = getPool();
  const statusFilter = includeInactive ? '' : "WHERE status = 'active'";
  const result = await pool.query<TenantBasicInfo>(
    `SELECT id, name, schema_name, status, subscription_type 
     FROM shared.tenants 
     ${statusFilter}
     ORDER BY name`
  );
  return result.rows;
}

/**
 * Get tenant schema name by tenant ID
 * @param tenantId - Tenant UUID
 * @returns Schema name or null if not found
 */
export async function getTenantSchemaName(tenantId: string): Promise<string | null> {
  const tenant = await getTenantById(tenantId);
  return tenant?.schema_name || null;
}
