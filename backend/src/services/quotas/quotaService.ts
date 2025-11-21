import type { PoolClient } from 'pg';

export type ResourceType = 'api_calls' | 'storage_gb' | 'users' | 'students' | 'api_requests_per_minute';
export type ResetPeriod = 'hourly' | 'daily' | 'monthly' | 'yearly' | 'never';

export interface QuotaLimit {
  tenantId: string;
  resourceType: ResourceType;
  limitValue: number;
  currentUsage: number;
  resetPeriod: ResetPeriod;
  warningThreshold?: number;
  isEnforced: boolean;
  last_reset_at?: Date | string | null;
}

export interface CheckQuotaResult {
  allowed: boolean;
  remaining: number;
  warning?: boolean;
}

/**
 * Get quota limit for a tenant and resource type
 */
export async function getQuotaLimit(
  client: PoolClient,
  tenantId: string,
  resourceType: ResourceType
): Promise<QuotaLimit | null> {
  const result = await client.query(
    `
      SELECT * FROM shared.quota_limits
      WHERE tenant_id = $1 AND resource_type = $2
    `,
    [tenantId, resourceType]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    tenantId: row.tenant_id,
    resourceType: row.resource_type,
    limitValue: Number(row.limit_value),
    currentUsage: Number(row.current_usage),
    resetPeriod: row.reset_period,
    warningThreshold: row.warning_threshold ? Number(row.warning_threshold) : undefined,
    isEnforced: row.is_enforced
  };
}

/**
 * Check if quota allows operation
 */
export async function checkQuota(
  client: PoolClient,
  tenantId: string,
  resourceType: ResourceType,
  amount: number = 1
): Promise<CheckQuotaResult> {
  const quota = await getQuotaLimit(client, tenantId, resourceType);

  if (!quota) {
    // No quota set = unlimited
    return { allowed: true, remaining: Infinity };
  }

  if (!quota.isEnforced) {
    return { allowed: true, remaining: quota.limitValue - quota.currentUsage };
  }

  // Check if reset is needed
  await maybeResetQuota(client, quota);

  // Refresh quota after potential reset
  const updatedQuota = await getQuotaLimit(client, tenantId, resourceType);
  if (!updatedQuota) {
    return { allowed: true, remaining: Infinity };
  }

  const remaining = updatedQuota.limitValue - updatedQuota.currentUsage;
  const allowed = remaining >= amount;

  // Check warning threshold
  const warning = updatedQuota.warningThreshold
    ? updatedQuota.currentUsage >= (updatedQuota.limitValue * updatedQuota.warningThreshold / 100)
    : false;

  return { allowed, remaining: Math.max(0, remaining), warning };
}

/**
 * Increment quota usage
 */
export async function incrementQuotaUsage(
  client: PoolClient,
  tenantId: string,
  resourceType: ResourceType,
  amount: number = 1
): Promise<void> {
  await client.query(
    `
      INSERT INTO shared.quota_limits (
        tenant_id, resource_type, limit_value, current_usage, reset_period
      )
      VALUES ($1, $2, 0, $3, 'never')
      ON CONFLICT (tenant_id, resource_type)
      DO UPDATE SET
        current_usage = shared.quota_limits.current_usage + $3,
        updated_at = NOW()
    `,
    [tenantId, resourceType, amount]
  );
}

/**
 * Set quota limit
 */
export async function setQuotaLimit(
  client: PoolClient,
  tenantId: string,
  resourceType: ResourceType,
  limitValue: number,
  resetPeriod: ResetPeriod = 'monthly',
  warningThreshold?: number,
  isEnforced: boolean = true
): Promise<unknown> {
  const result = await client.query(
    `
      INSERT INTO shared.quota_limits (
        tenant_id, resource_type, limit_value, current_usage,
        reset_period, warning_threshold, is_enforced, last_reset_at
      )
      VALUES ($1, $2, $3, 0, $4, $5, $6, NOW())
      ON CONFLICT (tenant_id, resource_type)
      DO UPDATE SET
        limit_value = EXCLUDED.limit_value,
        reset_period = EXCLUDED.reset_period,
        warning_threshold = EXCLUDED.warning_threshold,
        is_enforced = EXCLUDED.is_enforced,
        updated_at = NOW()
      RETURNING *
    `,
    [tenantId, resourceType, limitValue, resetPeriod, warningThreshold || null, isEnforced]
  );

  return result.rows[0];
}

/**
 * Reset quota if period has elapsed
 */
async function maybeResetQuota(
  client: PoolClient,
  quota: QuotaLimit
): Promise<void> {
  const lastReset = new Date(quota.last_reset_at || new Date());
  const now = new Date();
  let shouldReset = false;

  switch (quota.resetPeriod) {
    case 'hourly':
      shouldReset = now.getTime() - lastReset.getTime() >= 60 * 60 * 1000;
      break;
    case 'daily':
      shouldReset = now.getTime() - lastReset.getTime() >= 24 * 60 * 60 * 1000;
      break;
    case 'monthly':
      shouldReset = now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear();
      break;
    case 'yearly':
      shouldReset = now.getFullYear() !== lastReset.getFullYear();
      break;
    case 'never':
      shouldReset = false;
      break;
  }

  if (shouldReset) {
    // Log usage before reset
    await client.query(
      `
        INSERT INTO shared.quota_usage_logs (
          tenant_id, resource_type, amount, period_start, period_end
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        quota.tenantId,
        quota.resourceType,
        quota.currentUsage,
        lastReset,
        now
      ]
    );

    // Reset quota
    await client.query(
      `
        UPDATE shared.quota_limits
        SET current_usage = 0,
            last_reset_at = NOW(),
            updated_at = NOW()
        WHERE tenant_id = $1 AND resource_type = $2
      `,
      [quota.tenantId, quota.resourceType]
    );
  }
}

/**
 * Get quota usage logs
 */
export async function getQuotaUsageLogs(
  client: PoolClient,
  tenantId: string,
  resourceType?: ResourceType,
  limit: number = 50
): Promise<unknown[]> {
  const conditions: string[] = ['tenant_id = $1'];
  const values: unknown[] = [tenantId];
  let paramIndex = 2;

  if (resourceType) {
    conditions.push(`resource_type = $${paramIndex++}`);
    values.push(resourceType);
  }

  values.push(limit);

  const result = await client.query(
    `
      SELECT * FROM shared.quota_usage_logs
      WHERE ${conditions.join(' AND ')}
      ORDER BY period_start DESC
      LIMIT $${paramIndex}
    `,
    values
  );

  return result.rows;
}

