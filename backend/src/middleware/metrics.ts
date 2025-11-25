/**
 * Prometheus Metrics Middleware
 * Collects HTTP metrics, business metrics, and system metrics
 */

import { Request, Response, NextFunction } from 'express';
import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Enable default metrics (CPU, memory, etc.)
collectDefaultMetrics({ register });

// HTTP Metrics
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const httpRequestSize = new Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
});

const httpResponseSize = new Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [100, 1000, 10000, 100000, 1000000],
});

// Business Metrics
const activeUsers = new Gauge({
  name: 'active_users_total',
  help: 'Number of active users',
  labelNames: ['tenant_id'],
});

const activeTenants = new Gauge({
  name: 'active_tenants_total',
  help: 'Number of active tenants',
});

const apiCallsTotal = new Counter({
  name: 'api_calls_total',
  help: 'Total number of API calls',
  labelNames: ['endpoint', 'method', 'tenant_id'],
});

const databaseQueryDuration = new Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

const databaseConnections = new Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections',
});

// Error Metrics
const errorsTotal = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'endpoint', 'status_code'],
});

// Authentication Metrics
const authAttempts = new Counter({
  name: 'auth_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['method', 'success'],
});

const authAttemptsSuccess = new Counter({
  name: 'auth_attempts_success_total',
  help: 'Total number of successful authentication attempts',
  labelNames: ['method'],
});

const authAttemptsFailed = new Counter({
  name: 'auth_attempts_failed_total',
  help: 'Total number of failed authentication attempts',
  labelNames: ['method', 'ip_address'],
});

const sessionsActive = new Gauge({
  name: 'sessions_active',
  help: 'Number of active sessions',
});

const tenantsTotal = new Gauge({
  name: 'tenants_total',
  help: 'Total number of active tenants',
});

// Failed Login IP Heatmap (using Gauge to track counts per IP)
const failedLoginIPCount = new Gauge({
  name: 'failed_login_attempts_by_ip',
  help: 'Number of failed login attempts by IP address',
  labelNames: ['ip_address'],
});

// Export metrics for Prometheus scraping
export function getMetrics() {
  return register.metrics();
}

export function getMetricsContentType() {
  return register.contentType;
}

/**
 * Middleware to collect HTTP metrics
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const start = Date.now();
    const route = req.route?.path || req.path || 'unknown';

    // Track request size
    try {
      const requestSize = req.headers['content-length']
        ? parseInt(req.headers['content-length'], 10)
        : 0;
      if (requestSize > 0) {
        httpRequestSize.observe({ method: req.method, route }, requestSize);
      }
    } catch (err) {
      console.error('[Metrics] Failed to track request size:', err);
    }

    // Override res.end to capture response metrics
    const originalEnd = res.end.bind(res);
    (res as { end: typeof res.end }).end = function (
      chunk?: unknown,
      encoding?: unknown,
      cb?: unknown
    ): Response {
      try {
        const duration = (Date.now() - start) / 1000;
        const statusCode = res.statusCode.toString();

        // Record metrics
        httpRequestDuration.observe(
          { method: req.method, route, status_code: statusCode },
          duration
        );
        httpRequestTotal.inc({ method: req.method, route, status_code: statusCode });

        // Track response size
        if (chunk) {
          const responseSize = Buffer.isBuffer(chunk) ? chunk.length : String(chunk).length;
          httpResponseSize.observe(
            { method: req.method, route, status_code: statusCode },
            responseSize
          );
        }
      } catch (metricsError) {
        console.error('[Metrics] Failed to record metrics:', metricsError);
      }

      // Call original end with proper signature handling
      try {
        if (typeof encoding === 'function') {
          return originalEnd(chunk, encoding as () => void);
        } else if (typeof cb === 'function' && typeof encoding === 'string') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return originalEnd(chunk, encoding as any, cb as () => void);
        } else if (typeof encoding === 'string') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return originalEnd(chunk, encoding as any);
        } else {
          return originalEnd(chunk);
        }
      } catch (endError) {
        console.error('[Metrics] Failed to call original res.end:', endError);
        // Fallback: try calling with minimal args
        try {
          return originalEnd(chunk);
        } catch {
          // If all else fails, return response
          return res;
        }
      }
    } as typeof res.end;

    next();
  } catch (error) {
    // If metrics middleware fails, log but don't block the request
    console.error('[Metrics] Middleware error:', error);
    next();
  }
}

/**
 * Track business metrics
 */
export const metrics = {
  incrementApiCall: (endpoint: string, method: string, tenantId?: string) => {
    apiCallsTotal.inc({ endpoint, method, tenant_id: tenantId || 'unknown' });
  },

  recordDatabaseQuery: (queryType: string, table: string, duration: number) => {
    databaseQueryDuration.observe({ query_type: queryType, table }, duration);
  },

  setActiveUsers: (count: number, tenantId?: string) => {
    activeUsers.set({ tenant_id: tenantId || 'all' }, count);
  },

  setActiveTenants: (count: number) => {
    activeTenants.set(count);
  },

  setDatabaseConnections: (count: number) => {
    databaseConnections.set(count);
  },

  incrementError: (type: string, endpoint: string, statusCode: number) => {
    errorsTotal.inc({ type, endpoint, status_code: statusCode.toString() });
  },

  incrementAuthAttempt: (method: string, success: boolean, ipAddress?: string) => {
    authAttempts.inc({ method, success: success.toString() });
    if (success) {
      authAttemptsSuccess.inc({ method });
    } else {
      authAttemptsFailed.inc({ method, ip_address: ipAddress || 'unknown' });
      // Update failed login IP gauge
      if (ipAddress) {
        failedLoginIPCount.inc({ ip_address: ipAddress });
      }
    }
  },

  setActiveSessions: (count: number) => {
    sessionsActive.set(count);
  },

  setTenantsTotal: (count: number) => {
    tenantsTotal.set(count);
  },

  setFailedLoginIPCount: (ipAddress: string, count: number) => {
    failedLoginIPCount.set({ ip_address: ipAddress }, count);
  },

  resetFailedLoginIPCount: (ipAddress: string) => {
    // Remove specific IP address gauge (reset to 0)
    failedLoginIPCount.remove({ ip_address: ipAddress });
  },
};
