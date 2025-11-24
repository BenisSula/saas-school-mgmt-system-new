/**
 * Enhanced Health Check Service
 * Provides detailed health status for all system components
 */

import { getPool } from '../../db/connection';
// PoolClient type not used in this file but may be needed for future implementations

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: ComponentHealth;
    redis?: ComponentHealth;
    storage?: ComponentHealth;
    externalApis?: ComponentHealth;
  };
  metrics: {
    memoryUsage: number;
    cpuUsage?: number;
    activeConnections: number;
    requestRate: number;
  };
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  message?: string;
  lastChecked: string;
}

const startTime = Date.now();

/**
 * Check database health
 */
async function checkDatabase(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      const responseTime = Date.now() - start;

      // Check connection pool stats
      const poolStats = {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      };

      return {
        status: responseTime < 1000 ? 'healthy' : responseTime < 3000 ? 'degraded' : 'unhealthy',
        responseTime,
        message: `Pool: ${poolStats.total} total, ${poolStats.idle} idle, ${poolStats.waiting} waiting`,
        lastChecked: new Date().toISOString(),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - start,
      message: error instanceof Error ? error.message : 'Database connection failed',
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check Redis health (if configured)
 */
async function checkRedis(): Promise<ComponentHealth | undefined> {
  // In production, implement actual Redis health check
  return undefined;
}

/**
 * Check storage health (S3, etc.)
 */
async function checkStorage(): Promise<ComponentHealth | undefined> {
  // In production, implement actual storage health check
  return undefined;
}

/**
 * Check external APIs health
 */
async function checkExternalApis(): Promise<ComponentHealth | undefined> {
  // In production, implement actual external API health checks
  return undefined;
}

/**
 * Get system metrics
 */
function getSystemMetrics(): HealthStatus['metrics'] {
  const memoryUsage = process.memoryUsage();
  const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;

  return {
    memoryUsage: memoryUsageMB,
    activeConnections: 0, // Will be updated by metrics middleware
    requestRate: 0, // Will be updated by metrics middleware
  };
}

/**
 * Get overall health status
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  const [databaseHealth, redisHealth, storageHealth, externalApisHealth] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkStorage(),
    checkExternalApis(),
  ]);

  const checks: HealthStatus['checks'] = {
    database: databaseHealth,
  };

  if (redisHealth) checks.redis = redisHealth;
  if (storageHealth) checks.storage = storageHealth;
  if (externalApisHealth) checks.externalApis = externalApisHealth;

  // Determine overall status
  const allHealthy = Object.values(checks).every((check) => check.status === 'healthy');
  const anyUnhealthy = Object.values(checks).some((check) => check.status === 'unhealthy');

  const overallStatus: HealthStatus['status'] = anyUnhealthy
    ? 'unhealthy'
    : allHealthy
      ? 'healthy'
      : 'degraded';

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
    metrics: getSystemMetrics(),
  };
}

/**
 * Get readiness status (for Kubernetes)
 */
export async function getReadinessStatus(): Promise<{
  ready: boolean;
  checks: Record<string, boolean>;
}> {
  const health = await getHealthStatus();
  const checks: Record<string, boolean> = {};

  Object.entries(health.checks).forEach(([key, value]) => {
    checks[key] = value.status === 'healthy';
  });

  return {
    ready: health.status === 'healthy',
    checks,
  };
}

/**
 * Get liveness status (for Kubernetes)
 */
export function getLivenessStatus(): { alive: boolean; uptime: number } {
  return {
    alive: true,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };
}
