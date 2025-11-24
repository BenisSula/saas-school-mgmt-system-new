import crypto from 'crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';

export const subscriptionStatusSchema = z.enum([
  'active',
  'canceled',
  'past_due',
  'trialing',
  'unpaid',
]);
export const billingCycleSchema = z.enum(['monthly', 'yearly']);

export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;
export type BillingCycle = z.infer<typeof billingCycleSchema>;

export interface SubscriptionPlan {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  features: Record<string, unknown>;
}

export interface CreateSubscriptionInput {
  tenantId: string;
  planId: string;
  planName: string;
  billingCycle: BillingCycle;
  amount: number;
  currency?: string;
  trialDays?: number;
  providerSubscriptionId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateSubscriptionInput {
  planId?: string;
  planName?: string;
  status?: SubscriptionStatus;
  cancelAtPeriodEnd?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Create a new subscription for a tenant
 */
export async function createSubscription(
  client: PoolClient,
  input: CreateSubscriptionInput,
  actorId?: string
): Promise<{ id: string; subscription: unknown }> {
  const subscriptionId = crypto.randomUUID();
  const currency = input.currency || 'USD';
  const now = new Date();

  // Calculate period dates
  const periodStart = now;
  let periodEnd: Date;
  if (input.billingCycle === 'monthly') {
    periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  } else {
    periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  }

  // Calculate trial dates if applicable
  let trialStart: Date | null = null;
  let trialEnd: Date | null = null;
  if (input.trialDays && input.trialDays > 0) {
    trialStart = now;
    trialEnd = new Date(now.getTime() + input.trialDays * 24 * 60 * 60 * 1000);
  }

  const status: SubscriptionStatus = trialStart ? 'trialing' : 'active';

  await client.query('BEGIN');
  try {
    // Create subscription
    const subscriptionResult = await client.query(
      `
        INSERT INTO shared.subscriptions (
          id, tenant_id, plan_id, plan_name, status, billing_cycle,
          amount, currency, current_period_start, current_period_end,
          trial_start, trial_end, provider_subscription_id, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `,
      [
        subscriptionId,
        input.tenantId,
        input.planId,
        input.planName,
        status,
        input.billingCycle,
        input.amount,
        currency,
        periodStart,
        periodEnd,
        trialStart,
        trialEnd,
        input.providerSubscriptionId || null,
        JSON.stringify(input.metadata || {}),
      ]
    );

    // Record subscription history
    await client.query(
      `
        INSERT INTO shared.subscription_history (
          subscription_id, tenant_id, event_type, new_value, actor_id
        )
        VALUES ($1, $2, 'created', $3, $4)
      `,
      [subscriptionId, input.tenantId, JSON.stringify(subscriptionResult.rows[0]), actorId || null]
    );

    await client.query('COMMIT');

    return {
      id: subscriptionId,
      subscription: subscriptionResult.rows[0],
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/**
 * Update an existing subscription
 */
export async function updateSubscription(
  client: PoolClient,
  subscriptionId: string,
  input: UpdateSubscriptionInput,
  actorId?: string
): Promise<unknown> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.planId) {
    updates.push(`plan_id = $${paramIndex++}`);
    values.push(input.planId);
  }
  if (input.planName) {
    updates.push(`plan_name = $${paramIndex++}`);
    values.push(input.planName);
  }
  if (input.status) {
    updates.push(`status = $${paramIndex++}`);
    values.push(input.status);
  }
  if (input.cancelAtPeriodEnd !== undefined) {
    updates.push(`cancel_at_period_end = $${paramIndex++}`);
    values.push(input.cancelAtPeriodEnd);
    if (input.cancelAtPeriodEnd) {
      updates.push(`canceled_at = $${paramIndex++}`);
      values.push(new Date());
    }
  }
  if (input.metadata) {
    updates.push(`metadata = $${paramIndex++}`);
    values.push(JSON.stringify(input.metadata));
  }

  if (updates.length === 0) {
    throw new Error('No updates provided');
  }

  updates.push(`updated_at = NOW()`);
  values.push(subscriptionId);

  await client.query('BEGIN');
  try {
    // Get old value for history
    const oldResult = await client.query('SELECT * FROM shared.subscriptions WHERE id = $1', [
      subscriptionId,
    ]);
    if (oldResult.rowCount === 0) {
      throw new Error('Subscription not found');
    }
    const oldValue = oldResult.rows[0];

    // Update subscription
    const updateResult = await client.query(
      `
        UPDATE shared.subscriptions
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `,
      values
    );

    const newValue = updateResult.rows[0];

    // Record history
    await client.query(
      `
        INSERT INTO shared.subscription_history (
          subscription_id, tenant_id, event_type, old_value, new_value, actor_id
        )
        VALUES ($1, $2, 'updated', $3, $4, $5)
      `,
      [
        subscriptionId,
        newValue.tenant_id,
        JSON.stringify(oldValue),
        JSON.stringify(newValue),
        actorId || null,
      ]
    );

    await client.query('COMMIT');
    return newValue;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/**
 * Get subscription by tenant ID
 */
export async function getSubscriptionByTenantId(
  client: PoolClient,
  tenantId: string
): Promise<unknown | null> {
  const result = await client.query(
    `
      SELECT * FROM shared.subscriptions
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [tenantId]
  );

  return result.rows[0] || null;
}

/**
 * Get subscription by ID
 */
export async function getSubscriptionById(
  client: PoolClient,
  subscriptionId: string
): Promise<unknown | null> {
  const result = await client.query('SELECT * FROM shared.subscriptions WHERE id = $1', [
    subscriptionId,
  ]);

  return result.rows[0] || null;
}

/**
 * Renew subscription (extend current period)
 */
export async function renewSubscription(
  client: PoolClient,
  subscriptionId: string,
  actorId?: string
): Promise<unknown> {
  await client.query('BEGIN');
  try {
    const subscriptionResult = await client.query(
      'SELECT * FROM shared.subscriptions WHERE id = $1',
      [subscriptionId]
    );

    if (subscriptionResult.rowCount === 0) {
      throw new Error('Subscription not found');
    }

    const subscription = subscriptionResult.rows[0];
    const currentPeriodEnd = new Date(subscription.current_period_end);
    const now = new Date();

    if (currentPeriodEnd > now) {
      throw new Error('Subscription period has not ended yet');
    }

    // Calculate new period end
    let newPeriodEnd: Date;
    if (subscription.billing_cycle === 'monthly') {
      newPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    } else {
      newPeriodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    }

    // Update subscription
    const updateResult = await client.query(
      `
        UPDATE shared.subscriptions
        SET current_period_start = $1,
            current_period_end = $2,
            status = 'active',
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `,
      [now, newPeriodEnd, subscriptionId]
    );

    // Record history
    await client.query(
      `
        INSERT INTO shared.subscription_history (
          subscription_id, tenant_id, event_type, new_value, actor_id
        )
        VALUES ($1, $2, 'renewed', $3, $4)
      `,
      [
        subscriptionId,
        subscription.tenant_id,
        JSON.stringify(updateResult.rows[0]),
        actorId || null,
      ]
    );

    await client.query('COMMIT');
    return updateResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(
  client: PoolClient,
  subscriptionId: string,
  cancelImmediately: boolean = false,
  actorId?: string
): Promise<unknown> {
  await client.query('BEGIN');
  try {
    const subscriptionResult = await client.query(
      'SELECT * FROM shared.subscriptions WHERE id = $1',
      [subscriptionId]
    );

    if (subscriptionResult.rowCount === 0) {
      throw new Error('Subscription not found');
    }

    const subscription = subscriptionResult.rows[0];
    const now = new Date();

    let updateQuery: string;
    let updateValues: unknown[];

    if (cancelImmediately) {
      updateQuery = `
        UPDATE shared.subscriptions
        SET status = 'canceled',
            canceled_at = $1,
            cancel_at_period_end = FALSE,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      updateValues = [now, subscriptionId];
    } else {
      updateQuery = `
        UPDATE shared.subscriptions
        SET cancel_at_period_end = TRUE,
            canceled_at = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      updateValues = [now, subscriptionId];
    }

    const updateResult = await client.query(updateQuery, updateValues);

    // Record history
    await client.query(
      `
        INSERT INTO shared.subscription_history (
          subscription_id, tenant_id, event_type, old_value, new_value, actor_id
        )
        VALUES ($1, $2, 'canceled', $3, $4, $5)
      `,
      [
        subscriptionId,
        subscription.tenant_id,
        JSON.stringify(subscription),
        JSON.stringify(updateResult.rows[0]),
        actorId || null,
      ]
    );

    await client.query('COMMIT');
    return updateResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/**
 * Get subscription history
 */
export async function getSubscriptionHistory(
  client: PoolClient,
  subscriptionId: string,
  limit: number = 50
): Promise<unknown[]> {
  const result = await client.query(
    `
      SELECT * FROM shared.subscription_history
      WHERE subscription_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [subscriptionId, limit]
  );

  return result.rows;
}
