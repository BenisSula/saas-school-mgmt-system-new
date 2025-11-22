/**
 * Shared Admin Route Helpers
 * DRY: Centralizes common patterns used across admin routes
 */

import { getPool } from '../../db/connection';
import type { PoolClient } from 'pg';

export interface TenantContext {
  id: string;
  schema: string;
}

export interface UserContext {
  id: string;
  role: string;
}

/**
 * Get school ID for a tenant
 * DRY: This pattern is used in multiple admin routes
 */
export async function getSchoolIdForTenant(tenantId: string): Promise<string | null> {
  const pool = getPool();
  const result = await pool.query<{ id: string }>(
    `SELECT id FROM shared.schools WHERE tenant_id = $1 LIMIT 1`,
    [tenantId]
  );
  return result.rows[0]?.id || null;
}

/**
 * Verify tenant context exists
 * DRY: Common validation pattern
 */
export function verifyTenantContext(
  tenant: TenantContext | undefined,
  tenantClient: PoolClient | undefined
): { isValid: boolean; error?: string } {
  if (!tenant) {
    return { isValid: false, error: 'Tenant context missing' };
  }
  if (!tenantClient) {
    return { isValid: false, error: 'Tenant client missing' };
  }
  return { isValid: true };
}

/**
 * Verify user context exists
 * DRY: Common validation pattern
 */
export function verifyUserContext(user: UserContext | undefined): { isValid: boolean; error?: string } {
  if (!user) {
    return { isValid: false, error: 'User context missing' };
  }
  return { isValid: true };
}

/**
 * Verify tenant and user context
 * DRY: Combined validation
 */
export function verifyTenantAndUserContext(
  tenant: TenantContext | undefined,
  tenantClient: PoolClient | undefined,
  user: UserContext | undefined
): { isValid: boolean; error?: string } {
  const tenantCheck = verifyTenantContext(tenant, tenantClient);
  if (!tenantCheck.isValid) {
    return tenantCheck;
  }
  const userCheck = verifyUserContext(user);
  if (!userCheck.isValid) {
    return userCheck;
  }
  return { isValid: true };
}

