import { Pool } from 'pg';
import crypto from 'crypto';
import { getPool } from '../db/connection';
import {
  createTenantSchema,
  runTenantMigrations,
  seedTenant,
  type TenantInput
} from '../db/tenantManager';

export type TenantPreparationStatus = 'pending' | 'preparing' | 'ready' | 'failed';

export interface TenantPreparationResult {
  tenantId: string;
  status: TenantPreparationStatus;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

/**
 * Update tenant preparation status
 */
async function updatePreparationStatus(
  pool: Pool,
  tenantId: string,
  status: TenantPreparationStatus,
  error?: string
): Promise<void> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  updates.push(`preparation_status = $${paramIndex++}`);
  values.push(status);

  if (status === 'preparing') {
    updates.push(`preparation_started_at = NOW()`);
  } else if (status === 'ready' || status === 'failed') {
    updates.push(`preparation_completed_at = NOW()`);
  }

  if (error) {
    updates.push(`preparation_error = $${paramIndex++}`);
    values.push(error);
  }

  await pool.query(
    `
      UPDATE shared.tenants
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `,
    [...values, tenantId]
  );
}

/**
 * Prepare tenant in background (async)
 * Creates schema, runs migrations, and seeds data
 */
export async function prepareTenantInBackground(
  tenantId: string,
  tenantInput: TenantInput
): Promise<void> {
  const pool = getPool();

  try {
    // Update status to 'preparing'
    await updatePreparationStatus(pool, tenantId, 'preparing');

    console.log(`[tenantPreparation] Starting preparation for tenant ${tenantId} (${tenantInput.schemaName})`);

    // Step 1: Create schema
    await createTenantSchema(pool, tenantInput.schemaName);
    console.log(`[tenantPreparation] Schema created: ${tenantInput.schemaName}`);

    // Step 2: Run migrations (this can be heavy)
    await runTenantMigrations(pool, tenantInput.schemaName);
    console.log(`[tenantPreparation] Migrations completed: ${tenantInput.schemaName}`);

    // Step 3: Seed tenant (minimal data)
    await seedTenant(pool, tenantInput.schemaName);
    console.log(`[tenantPreparation] Seeding completed: ${tenantInput.schemaName}`);

    // Step 4: Mark as ready
    await updatePreparationStatus(pool, tenantId, 'ready');
    console.log(`[tenantPreparation] Tenant ${tenantId} is ready`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[tenantPreparation] Failed to prepare tenant ${tenantId}:`, errorMessage);

    // Update status to 'failed'
    await updatePreparationStatus(pool, tenantId, 'failed', errorMessage);

    // Re-throw to allow caller to handle
    throw error;
  }
}

/**
 * Get tenant preparation status
 */
export async function getTenantPreparationStatus(
  tenantId: string
): Promise<{
  status: TenantPreparationStatus;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
} | null> {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT 
        preparation_status,
        preparation_error,
        preparation_started_at,
        preparation_completed_at
      FROM shared.tenants
      WHERE id = $1
    `,
    [tenantId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    status: (row.preparation_status || 'ready') as TenantPreparationStatus,
    error: row.preparation_error || undefined,
    startedAt: row.preparation_started_at ? new Date(row.preparation_started_at) : undefined,
    completedAt: row.preparation_completed_at ? new Date(row.preparation_completed_at) : undefined
  };
}

/**
 * Create tenant record with 'pending' status
 * Actual preparation happens in background
 */
export async function createTenantWithPendingStatus(
  tenantInput: TenantInput
): Promise<{ id: string }> {
  const pool = getPool();
  const tenantId = crypto.randomUUID();

  // Create tenant record with 'pending' status
  await pool.query(
    `
      INSERT INTO shared.tenants (
        id, 
        name, 
        domain, 
        schema_name, 
        subscription_type, 
        status, 
        billing_email,
        preparation_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
      RETURNING id
    `,
    [
      tenantId,
      tenantInput.name,
      tenantInput.domain ?? null,
      tenantInput.schemaName,
      tenantInput.subscriptionType ?? 'trial',
      tenantInput.status ?? 'active',
      tenantInput.billingEmail ?? null
    ]
  );

  return { id: tenantId };
}

