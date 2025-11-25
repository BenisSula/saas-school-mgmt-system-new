import { getPool } from '../../db/connection';
import { recordSharedAuditLog } from '../auditLogService';

export type SubscriptionTier = 'free' | 'trial' | 'paid';

export interface SubscriptionTierConfig {
  id: string;
  tier: SubscriptionTier;
  name: string;
  description: string | null;
  monthlyPrice: number;
  yearlyPrice: number;
  maxUsers: number | null;
  maxStudents: number | null;
  maxTeachers: number | null;
  maxStorageGb: number | null;
  features: Record<string, unknown>;
  limits: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateTierConfigInput {
  name?: string;
  description?: string;
  monthlyPrice?: number;
  yearlyPrice?: number;
  maxUsers?: number | null;
  maxStudents?: number | null;
  maxTeachers?: number | null;
  maxStorageGb?: number | null;
  features?: Record<string, unknown>;
  limits?: Record<string, unknown>;
  isActive?: boolean;
}

/**
 * Get all subscription tier configurations
 */
export async function getSubscriptionTierConfigs(): Promise<SubscriptionTierConfig[]> {
  const pool = getPool();
  const result = await pool.query<SubscriptionTierConfig>(
    `
      SELECT 
        id,
        tier,
        name,
        description,
        monthly_price as "monthlyPrice",
        yearly_price as "yearlyPrice",
        max_users as "maxUsers",
        max_students as "maxStudents",
        max_teachers as "maxTeachers",
        max_storage_gb as "maxStorageGb",
        features,
        limits,
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM shared.subscription_tiers
      ORDER BY 
        CASE tier
          WHEN 'free' THEN 1
          WHEN 'trial' THEN 2
          WHEN 'paid' THEN 3
        END
    `
  );
  return result.rows;
}

/**
 * Update subscription tier configuration
 */
export async function updateSubscriptionTierConfig(
  tier: SubscriptionTier,
  input: UpdateTierConfigInput,
  actorId?: string | null
): Promise<SubscriptionTierConfig> {
  const pool = getPool();

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(input.name);
  }
  if (input.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(input.description);
  }
  if (input.monthlyPrice !== undefined) {
    updates.push(`monthly_price = $${paramIndex++}`);
    values.push(input.monthlyPrice);
  }
  if (input.yearlyPrice !== undefined) {
    updates.push(`yearly_price = $${paramIndex++}`);
    values.push(input.yearlyPrice);
  }
  if (input.maxUsers !== undefined) {
    updates.push(`max_users = $${paramIndex++}`);
    values.push(input.maxUsers);
  }
  if (input.maxStudents !== undefined) {
    updates.push(`max_students = $${paramIndex++}`);
    values.push(input.maxStudents);
  }
  if (input.maxTeachers !== undefined) {
    updates.push(`max_teachers = $${paramIndex++}`);
    values.push(input.maxTeachers);
  }
  if (input.maxStorageGb !== undefined) {
    updates.push(`max_storage_gb = $${paramIndex++}`);
    values.push(input.maxStorageGb);
  }
  if (input.features !== undefined) {
    updates.push(`features = $${paramIndex++}::jsonb`);
    values.push(JSON.stringify(input.features));
  }
  if (input.limits !== undefined) {
    updates.push(`limits = $${paramIndex++}::jsonb`);
    values.push(JSON.stringify(input.limits));
  }
  if (input.isActive !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(input.isActive);
  }

  if (updates.length === 0) {
    throw new Error('No updates provided');
  }

  updates.push(`updated_at = NOW()`);
  values.push(tier);

  const result = await pool.query<SubscriptionTierConfig>(
    `
      UPDATE shared.subscription_tiers
      SET ${updates.join(', ')}
      WHERE tier = $${paramIndex}
      RETURNING 
        id,
        tier,
        name,
        description,
        monthly_price as "monthlyPrice",
        yearly_price as "yearlyPrice",
        max_users as "maxUsers",
        max_students as "maxStudents",
        max_teachers as "maxTeachers",
        max_storage_gb as "maxStorageGb",
        features,
        limits,
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `,
    values
  );

  if (result.rowCount === 0) {
    throw new Error(`Subscription tier '${tier}' not found`);
  }

  // Audit log
  await recordSharedAuditLog({
    userId: actorId ?? undefined,
    action: 'SUBSCRIPTION_TIER_UPDATED',
    entityType: 'SUBSCRIPTION',
    entityId: result.rows[0].id,
    details: {
      tier,
      changes: input,
    },
  });

  return result.rows[0];
}

/**
 * Bulk update subscription tier configurations
 */
export async function updateSubscriptionTierConfigs(
  configs: Array<{ tier: SubscriptionTier; config: UpdateTierConfigInput }>,
  actorId?: string | null
): Promise<SubscriptionTierConfig[]> {
  const results: SubscriptionTierConfig[] = [];

  for (const { tier, config } of configs) {
    const updated = await updateSubscriptionTierConfig(tier, config, actorId);
    results.push(updated);
  }

  return results;
}
