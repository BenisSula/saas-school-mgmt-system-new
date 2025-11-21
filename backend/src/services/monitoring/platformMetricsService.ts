/**
 * Platform Metrics Service
 * Collects and updates platform-wide metrics for Prometheus
 */

import { Pool } from 'pg';
import { getPool } from '../../db/connection';
import { metrics } from '../../middleware/metrics';
import { logger } from '../../lib/logger';

// Store previous IP counts to reset gauges
let previousIPCounts: Map<string, number> = new Map();

// Cache table existence checks to avoid repeated queries
let tableExistenceCache: Map<string, boolean> = new Map();
const TABLE_EXISTENCE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let tableExistenceCacheTime: Map<string, number> = new Map();

/**
 * Check if a table exists (with caching)
 */
async function tableExists(pool: Pool, schema: string, tableName: string): Promise<boolean> {
  const cacheKey = `${schema}.${tableName}`;
  const now = Date.now();
  
  // Check cache
  if (tableExistenceCache.has(cacheKey)) {
    const cacheTime = tableExistenceCacheTime.get(cacheKey) || 0;
    if (now - cacheTime < TABLE_EXISTENCE_CACHE_TTL) {
      return tableExistenceCache.get(cacheKey)!;
    }
  }
  
  // Query database
  try {
    const result = await pool.query(
      `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 
          AND table_name = $2
        )
      `,
      [schema, tableName]
    );
    
    const exists = result.rows[0]?.exists || false;
    
    // Update cache
    tableExistenceCache.set(cacheKey, exists);
    tableExistenceCacheTime.set(cacheKey, now);
    
    return exists;
  } catch (error) {
    // On error, assume table doesn't exist and cache negative result
    tableExistenceCache.set(cacheKey, false);
    tableExistenceCacheTime.set(cacheKey, now);
    return false;
  }
}

/**
 * Collect and update platform metrics
 * Should be called periodically (e.g., every 30 seconds)
 */
export async function collectPlatformMetrics(): Promise<void> {
  try {
    const pool = getPool();
    
    // Collect metrics in parallel
    await Promise.all([
      updateActiveSessionsCount(pool),
      updateTenantCount(pool),
      updateLoginAttemptsMetrics(pool),
      updateFailedLoginIPMetrics(pool)
    ]);
  } catch (error) {
    logger.error({ err: error }, '[platformMetricsService] Failed to collect platform metrics');
  }
}

/**
 * Update active sessions count
 */
async function updateActiveSessionsCount(pool: Pool): Promise<void> {
  // Check if table exists first (silently skip if not)
  const exists = await tableExists(pool, 'shared', 'user_sessions');
  if (!exists) {
    return; // Silently skip - table doesn't exist (expected when migrations haven't run)
  }
  
  try {
    const result = await pool.query(
      `
        SELECT COUNT(*) as count
        FROM shared.user_sessions
        WHERE is_active = TRUE
          AND expires_at > NOW()
      `
    );
    
    const count = parseInt(result.rows[0]?.count || '0', 10);
    metrics.setActiveSessions(count);
  } catch (error) {
    // Only log actual errors, not expected missing table/column errors
    if (error instanceof Error && 
        (error.message.includes('does not exist') || 
         (error.message.includes('column') && error.message.includes('does not exist')))) {
      // Silently skip - expected when migrations haven't run
      return;
    }
    logger.error({ err: error }, '[platformMetricsService] Failed to update active sessions count');
  }
}

/**
 * Update tenant count
 */
async function updateTenantCount(pool: Pool): Promise<void> {
  try {
    const result = await pool.query(
      `
        SELECT COUNT(*) as count
        FROM shared.tenants
        WHERE status = 'active' OR status IS NULL
      `
    );
    
    const count = parseInt(result.rows[0]?.count || '0', 10);
    metrics.setActiveTenants(count);
    metrics.setTenantsTotal(count);
  } catch (error) {
    logger.error({ err: error }, '[platformMetricsService] Failed to update tenant count');
  }
}

/**
 * Update login attempts metrics (success/fail counts)
 */
async function updateLoginAttemptsMetrics(pool: Pool): Promise<void> {
  // Check if table exists first (silently skip if not)
  const exists = await tableExists(pool, 'shared', 'login_attempts');
  if (!exists) {
    return; // Silently skip - table doesn't exist (expected when migrations haven't run)
  }
  
  try {
    // Get success/fail counts from last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const result = await pool.query(
      `
        SELECT 
          success,
          COUNT(*) as count
        FROM shared.login_attempts
        WHERE attempted_at >= $1
        GROUP BY success
      `,
      [oneHourAgo]
    );
    
    // Reset counters and set new values
    // Note: Prometheus counters are cumulative, so we track via increment
    // For accurate counts, we'd need to use a Gauge instead
    // For now, we'll track via the authAttempts counter which is incremented on each attempt
  } catch (error) {
    // Only log actual errors, not expected missing table errors
    if (error instanceof Error && error.message.includes('does not exist')) {
      // Silently skip - expected when migrations haven't run
      return;
    }
    logger.error({ err: error }, '[platformMetricsService] Failed to update login attempts metrics');
  }
}

/**
 * Update failed login IP metrics for heatmap
 */
async function updateFailedLoginIPMetrics(pool: Pool): Promise<void> {
  // Check if table exists first (silently skip if not)
  const exists = await tableExists(pool, 'shared', 'login_attempts');
  if (!exists) {
    return; // Silently skip - table doesn't exist (expected when migrations haven't run)
  }
  
  try {
    // Get failed login attempts by IP from last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const result = await pool.query(
      `
        SELECT 
          ip_address,
          COUNT(*) as attempt_count
        FROM shared.login_attempts
        WHERE success = FALSE
          AND attempted_at >= $1
          AND ip_address IS NOT NULL
        GROUP BY ip_address
        ORDER BY attempt_count DESC
        LIMIT 100
      `,
      [oneDayAgo]
    );
    
    // Update failed login IP gauge
    const currentIPCounts = new Map<string, number>();
    
    for (const row of result.rows) {
      const ip = row.ip_address;
      const count = parseInt(row.attempt_count || '0', 10);
      currentIPCounts.set(ip, count);
      metrics.setFailedLoginIPCount(ip, count);
    }
    
    // Reset IPs that are no longer in the top 100
    for (const [ip] of previousIPCounts) {
      if (!currentIPCounts.has(ip)) {
        metrics.resetFailedLoginIPCount(ip);
      }
    }
    
    previousIPCounts = currentIPCounts;
    
    // Log top IPs for monitoring (only in development or when DEBUG is enabled)
    if (result.rows.length > 0 && (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true')) {
      logger.debug(
        { topFailedIPs: result.rows.slice(0, 10).map(r => ({ ip: r.ip_address, count: r.attempt_count })) },
        '[platformMetricsService] Top failed login IPs'
      );
    }
  } catch (error) {
    // Only log actual errors, not expected missing table errors
    if (error instanceof Error && error.message.includes('does not exist')) {
      // Silently skip - expected when migrations haven't run
      return;
    }
    logger.error({ err: error }, '[platformMetricsService] Failed to update failed login IP metrics');
  }
}

/**
 * Start periodic metrics collection
 */
let metricsInterval: NodeJS.Timeout | null = null;
const METRICS_COLLECTION_INTERVAL_MS = 30 * 1000; // 30 seconds

export function startMetricsCollection(): void {
  if (metricsInterval) {
    logger.warn('[platformMetricsService] Metrics collection already running');
    return;
  }

  logger.info('[platformMetricsService] Starting platform metrics collection');
  
  // Collect immediately
  collectPlatformMetrics();
  
  // Then collect every 30 seconds
  metricsInterval = setInterval(() => {
    collectPlatformMetrics();
  }, METRICS_COLLECTION_INTERVAL_MS);
}

/**
 * Stop periodic metrics collection
 */
export function stopMetricsCollection(): void {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
    logger.info('[platformMetricsService] Stopped platform metrics collection');
  }
}

