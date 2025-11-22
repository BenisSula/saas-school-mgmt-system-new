import type { PoolClient } from 'pg';

export interface FeatureFlag {
  id: string;
  flagKey: string;
  flagName: string;
  description?: string;
  isEnabledGlobally: boolean;
  rolloutPercentage: number;
  enabledTenantIds: string[];
  disabledTenantIds: string[];
  metadata: Record<string, unknown>;
}

export interface CreateFeatureFlagInput {
  flagKey: string;
  flagName: string;
  description?: string;
  isEnabledGlobally?: boolean;
  rolloutPercentage?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Check if feature flag is enabled for tenant
 */
export async function isFeatureEnabled(
  client: PoolClient,
  flagKey: string,
  tenantId?: string
): Promise<boolean> {
  // Get feature flag
  const flagResult = await client.query(
    'SELECT * FROM shared.feature_flags WHERE flag_key = $1',
    [flagKey]
  );

  if (flagResult.rowCount === 0) {
    return false; // Flag doesn't exist = disabled
  }

  const flag = flagResult.rows[0];

  // Check explicit tenant overrides first
  if (tenantId) {
    // Check per-tenant override
    const tenantOverrideResult = await client.query(
      'SELECT is_enabled FROM shared.tenant_feature_flags WHERE tenant_id = $1 AND flag_key = $2',
      [tenantId, flagKey]
    );

    if ((tenantOverrideResult.rowCount ?? 0) > 0) {
      return tenantOverrideResult.rows[0].is_enabled;
    }

    // Check explicit enabled/disabled lists
    if (flag.enabled_tenant_ids && flag.enabled_tenant_ids.includes(tenantId)) {
      return true;
    }

    if (flag.disabled_tenant_ids && flag.disabled_tenant_ids.includes(tenantId)) {
      return false;
    }
  }

  // Check global enablement
  if (!flag.is_enabled_globally) {
    return false;
  }

  // Check rollout percentage
  if (flag.rollout_percentage < 100 && tenantId) {
    // Use tenant ID hash for consistent rollout
    const hash = simpleHash(tenantId);
    const percentage = (hash % 100) + 1;
    return percentage <= flag.rollout_percentage;
  }

  return flag.is_enabled_globally;
}

/**
 * Simple hash function for consistent tenant-based rollout
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Create feature flag
 */
export async function createFeatureFlag(
  client: PoolClient,
  input: CreateFeatureFlagInput,
  actorId?: string
): Promise<unknown> {
  await client.query('BEGIN');
  try {
    // Create flag
    const result = await client.query(
      `
        INSERT INTO shared.feature_flags (
          flag_key, flag_name, description, is_enabled_globally,
          rollout_percentage, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        input.flagKey,
        input.flagName,
        input.description || null,
        input.isEnabledGlobally || false,
        input.rolloutPercentage || 0,
        JSON.stringify(input.metadata || {})
      ]
    );

    const flag = result.rows[0];

    // Record history
    await client.query(
      `
        INSERT INTO shared.feature_flag_history (
          flag_id, action, new_value, actor_id
        )
        VALUES ($1, 'created', $2, $3)
      `,
      [flag.id, JSON.stringify(flag), actorId || null]
    );

    await client.query('COMMIT');
    return flag;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/**
 * Update feature flag
 */
export async function updateFeatureFlag(
  client: PoolClient,
  flagKey: string,
  updates: {
    flagName?: string;
    description?: string;
    isEnabledGlobally?: boolean;
    rolloutPercentage?: number;
    metadata?: Record<string, unknown>;
  },
  actorId?: string
): Promise<unknown> {
  await client.query('BEGIN');
  try {
    // Get old value
    const oldResult = await client.query(
      'SELECT * FROM shared.feature_flags WHERE flag_key = $1',
      [flagKey]
    );

    if (oldResult.rowCount === 0) {
      throw new Error('Feature flag not found');
    }

    const oldValue = oldResult.rows[0];

    // Build update query
    const updateFields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.flagName !== undefined) {
      updateFields.push(`flag_name = $${paramIndex++}`);
      values.push(updates.flagName);
    }

    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }

    if (updates.isEnabledGlobally !== undefined) {
      updateFields.push(`is_enabled_globally = $${paramIndex++}`);
      values.push(updates.isEnabledGlobally);
    }

    if (updates.rolloutPercentage !== undefined) {
      updateFields.push(`rollout_percentage = $${paramIndex++}`);
      values.push(updates.rolloutPercentage);
    }

    if (updates.metadata !== undefined) {
      updateFields.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(updates.metadata));
    }

    if (updateFields.length === 0) {
      throw new Error('No updates provided');
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(flagKey);

    // Update flag
    const updateResult = await client.query(
      `
        UPDATE shared.feature_flags
        SET ${updateFields.join(', ')}
        WHERE flag_key = $${paramIndex}
        RETURNING *
      `,
      values
    );

    const newValue = updateResult.rows[0];

    // Record history
    const action = updates.isEnabledGlobally !== undefined
      ? (updates.isEnabledGlobally ? 'enabled' : 'disabled')
      : updates.rolloutPercentage !== undefined
        ? 'rollout_changed'
        : 'updated';

    await client.query(
      `
        INSERT INTO shared.feature_flag_history (
          flag_id, action, old_value, new_value, actor_id
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        newValue.id,
        action,
        JSON.stringify(oldValue),
        JSON.stringify(newValue),
        actorId || null
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
 * Enable/disable feature flag for specific tenant
 */
export async function setTenantFeatureFlag(
  client: PoolClient,
  tenantId: string,
  flagKey: string,
  enabled: boolean,
  actorId?: string
): Promise<unknown> {
  await client.query('BEGIN');
  try {
    // Get flag
    const flagResult = await client.query(
      'SELECT id FROM shared.feature_flags WHERE flag_key = $1',
      [flagKey]
    );

    if (flagResult.rowCount === 0) {
      throw new Error('Feature flag not found');
    }

    const flagId = flagResult.rows[0].id;

    // Upsert tenant flag
    const result = await client.query(
      `
        INSERT INTO shared.tenant_feature_flags (
          tenant_id, flag_key, is_enabled, enabled_at, disabled_at
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (tenant_id, flag_key)
        DO UPDATE SET
          is_enabled = EXCLUDED.is_enabled,
          enabled_at = EXCLUDED.enabled_at,
          disabled_at = EXCLUDED.disabled_at,
          updated_at = NOW()
        RETURNING *
      `,
      [
        tenantId,
        flagKey,
        enabled,
        enabled ? new Date() : null,
        enabled ? null : new Date()
      ]
    );

    // Record history
    await client.query(
      `
        INSERT INTO shared.feature_flag_history (
          flag_id, tenant_id, action, new_value, actor_id
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        flagId,
        tenantId,
        enabled ? 'tenant_added' : 'tenant_removed',
        JSON.stringify({ enabled, tenantId }),
        actorId || null
      ]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/**
 * Get all feature flags
 */
export async function getAllFeatureFlags(
  client: PoolClient
): Promise<FeatureFlag[]> {
  const result = await client.query(
    'SELECT * FROM shared.feature_flags ORDER BY created_at DESC'
  );

  return result.rows.map(row => ({
    id: row.id,
    flagKey: row.flag_key,
    flagName: row.flag_name,
    description: row.description,
    isEnabledGlobally: row.is_enabled_globally,
    rolloutPercentage: row.rollout_percentage,
    enabledTenantIds: row.enabled_tenant_ids || [],
    disabledTenantIds: row.disabled_tenant_ids || [],
    metadata: row.metadata || {}
  }));
}

/**
 * Get feature flag by key
 */
export async function getFeatureFlag(
  client: PoolClient,
  flagKey: string
): Promise<FeatureFlag | null> {
  const result = await client.query(
    'SELECT * FROM shared.feature_flags WHERE flag_key = $1',
    [flagKey]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    flagKey: row.flag_key,
    flagName: row.flag_name,
    description: row.description,
    isEnabledGlobally: row.is_enabled_globally,
    rolloutPercentage: row.rollout_percentage,
    enabledTenantIds: row.enabled_tenant_ids || [],
    disabledTenantIds: row.disabled_tenant_ids || [],
    metadata: row.metadata || {}
  };
}

