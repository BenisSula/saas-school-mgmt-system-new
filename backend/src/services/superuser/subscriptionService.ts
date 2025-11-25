import { getPool } from '../../db/connection';
import { recordSharedAuditLog } from '../auditLogService';

export type SubscriptionTier = 'free' | 'trial' | 'paid';
export type SubscriptionStatus = 'active' | 'suspended' | 'cancelled' | 'expired';
export type BillingPeriod = 'monthly' | 'yearly' | 'quarterly' | 'annually';

export interface CreateSubscriptionInput {
  tenantId: string;
  tier: SubscriptionTier;
  status?: SubscriptionStatus;
  billingPeriod?: BillingPeriod;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialEndDate?: Date;
  customLimits?: Record<string, unknown>;
}

export interface UpdateSubscriptionInput {
  tier?: SubscriptionTier;
  status?: SubscriptionStatus;
  billingPeriod?: BillingPeriod;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialEndDate?: Date;
  customLimits?: Record<string, unknown>;
}

export interface SubscriptionRecord {
  id: string;
  tenantId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingPeriod: BillingPeriod | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  trialEndDate: Date | null;
  customLimits: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new subscription for a tenant
 */
export async function createSubscription(
  input: CreateSubscriptionInput,
  actorId?: string | null
): Promise<SubscriptionRecord> {
  const pool = getPool();

  // Verify tenant exists
  const tenantCheck = await pool.query('SELECT id FROM shared.tenants WHERE id = $1', [
    input.tenantId,
  ]);
  if (tenantCheck.rowCount === 0) {
    throw new Error('Tenant not found');
  }

  // Check if subscription already exists
  const existingCheck = await pool.query(
    'SELECT id FROM shared.subscriptions WHERE tenant_id = $1',
    [input.tenantId]
  );
  if ((existingCheck.rowCount ?? 0) > 0) {
    throw new Error('Subscription already exists for this tenant');
  }

  const now = new Date();
  const status = input.status || (input.tier === 'trial' ? 'active' : 'active');

  const result = await pool.query<SubscriptionRecord>(
    `
      INSERT INTO shared.subscriptions (
        tenant_id, tier, status, billing_period,
        current_period_start, current_period_end, trial_end_date, custom_limits
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      RETURNING *
    `,
    [
      input.tenantId,
      input.tier,
      status,
      input.billingPeriod || null,
      input.currentPeriodStart || now,
      input.currentPeriodEnd || null,
      input.trialEndDate || null,
      JSON.stringify(input.customLimits || {}),
    ]
  );

  const subscription = result.rows[0];

  // Record subscription history
  await pool.query(
    `
      INSERT INTO shared.subscription_history (
        subscription_id, changed_by, change_type, new_value, reason
      )
      VALUES ($1, $2, 'created', $3::jsonb, 'Subscription created by superuser')
    `,
    [subscription.id, actorId || null, JSON.stringify(subscription)]
  );

  // Audit log
  await recordSharedAuditLog({
    userId: actorId ?? undefined,
    action: 'SUBSCRIPTION_CREATED',
    entityType: 'SUBSCRIPTION',
    entityId: subscription.id,
    details: {
      tenantId: input.tenantId,
      tier: input.tier,
      status,
    },
  });

  return subscription;
}

/**
 * Get subscription by tenant ID
 */
export async function getSubscriptionByTenantId(
  tenantId: string
): Promise<SubscriptionRecord | null> {
  const pool = getPool();
  const result = await pool.query<SubscriptionRecord>(
    'SELECT * FROM shared.subscriptions WHERE tenant_id = $1',
    [tenantId]
  );
  return result.rows[0] || null;
}

/**
 * Get subscription by ID
 */
export async function getSubscriptionById(
  subscriptionId: string
): Promise<SubscriptionRecord | null> {
  const pool = getPool();
  const result = await pool.query<SubscriptionRecord>(
    'SELECT * FROM shared.subscriptions WHERE id = $1',
    [subscriptionId]
  );
  return result.rows[0] || null;
}

/**
 * Update subscription
 */
export async function updateSubscription(
  subscriptionId: string,
  input: UpdateSubscriptionInput,
  actorId?: string | null
): Promise<SubscriptionRecord> {
  const pool = getPool();

  // Get old value for history
  const oldResult = await pool.query<SubscriptionRecord>(
    'SELECT * FROM shared.subscriptions WHERE id = $1',
    [subscriptionId]
  );
  if (oldResult.rowCount === 0) {
    throw new Error('Subscription not found');
  }
  const oldValue = oldResult.rows[0];

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.tier !== undefined) {
    updates.push(`tier = $${paramIndex++}`);
    values.push(input.tier);
  }
  if (input.status !== undefined) {
    updates.push(`status = $${paramIndex++}`);
    values.push(input.status);
  }
  if (input.billingPeriod !== undefined) {
    updates.push(`billing_period = $${paramIndex++}`);
    values.push(input.billingPeriod);
  }
  if (input.currentPeriodStart !== undefined) {
    updates.push(`current_period_start = $${paramIndex++}`);
    values.push(input.currentPeriodStart);
  }
  if (input.currentPeriodEnd !== undefined) {
    updates.push(`current_period_end = $${paramIndex++}`);
    values.push(input.currentPeriodEnd);
  }
  if (input.trialEndDate !== undefined) {
    updates.push(`trial_end_date = $${paramIndex++}`);
    values.push(input.trialEndDate);
  }
  if (input.customLimits !== undefined) {
    updates.push(`custom_limits = $${paramIndex++}::jsonb`);
    values.push(JSON.stringify(input.customLimits));
  }

  if (updates.length === 0) {
    throw new Error('No updates provided');
  }

  updates.push(`updated_at = NOW()`);
  values.push(subscriptionId);

  const result = await pool.query<SubscriptionRecord>(
    `
      UPDATE shared.subscriptions
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `,
    values
  );

  const newValue = result.rows[0];

  // Record subscription history
  await pool.query(
    `
      INSERT INTO shared.subscription_history (
        subscription_id, changed_by, change_type, old_value, new_value, reason
      )
      VALUES ($1, $2, 'updated', $3::jsonb, $4::jsonb, 'Subscription updated by superuser')
    `,
    [subscriptionId, actorId || null, JSON.stringify(oldValue), JSON.stringify(newValue)]
  );

  // Audit log
  await recordSharedAuditLog({
    userId: actorId ?? undefined,
    action: 'SUBSCRIPTION_UPDATED',
    entityType: 'SUBSCRIPTION',
    entityId: subscriptionId,
    details: {
      tenantId: newValue.tenantId,
      changes: input,
    },
  });

  return newValue;
}

/**
 * Suspend subscription
 */
export async function suspendSubscription(
  subscriptionId: string,
  reason?: string,
  actorId?: string | null
): Promise<SubscriptionRecord> {
  return updateSubscription(subscriptionId, { status: 'suspended' }, actorId);
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  reason?: string,
  actorId?: string | null
): Promise<SubscriptionRecord> {
  return updateSubscription(subscriptionId, { status: 'cancelled' }, actorId);
}

/**
 * List all subscriptions
 */
export async function listSubscriptions(filters?: {
  tier?: SubscriptionTier;
  status?: SubscriptionStatus;
  tenantId?: string;
}): Promise<SubscriptionRecord[]> {
  const pool = getPool();
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters?.tier) {
    conditions.push(`tier = $${paramIndex++}`);
    values.push(filters.tier);
  }
  if (filters?.status) {
    conditions.push(`status = $${paramIndex++}`);
    values.push(filters.status);
  }
  if (filters?.tenantId) {
    conditions.push(`tenant_id = $${paramIndex++}`);
    values.push(filters.tenantId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query<SubscriptionRecord>(
    `
      SELECT * FROM shared.subscriptions
      ${whereClause}
      ORDER BY created_at DESC
    `,
    values
  );

  return result.rows;
}

/**
 * Get subscription history
 */
export async function getSubscriptionHistory(
  subscriptionId: string,
  limit: number = 50
): Promise<unknown[]> {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT * FROM shared.subscription_history
      WHERE subscription_id = $1
      ORDER BY changed_at DESC
      LIMIT $2
    `,
    [subscriptionId, limit]
  );
  return result.rows;
}
