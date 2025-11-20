import type { Request, Response, NextFunction } from 'express';
import { getPool } from '../db/connection';

/**
 * Per-tenant rate limiting middleware
 */
export function rateLimitPerTenant(
  requestsPerWindow: number,
  windowSeconds: number
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.tenant?.id) {
        return res.status(500).json({ message: 'Tenant context missing' });
      }

      const pool = getPool();
      const client = await pool.connect();

      try {
        const endpointPattern = req.path;
        const method = req.method;
        const identifier = req.user?.id || req.ip || 'anonymous';

        // Calculate window boundaries
        const now = new Date();
        const windowStart = new Date(now.getTime() - windowSeconds * 1000);
        const windowEnd = now;

        // Get or create rate limit tracking
        const trackingResult = await client.query(
          `
            INSERT INTO shared.rate_limit_tracking (
              tenant_id, endpoint_pattern, method, identifier,
              request_count, window_start, window_end
            )
            VALUES ($1, $2, $3, $4, 1, $5, $6)
            ON CONFLICT (tenant_id, endpoint_pattern, method, identifier, window_start)
            DO UPDATE SET
              request_count = shared.rate_limit_tracking.request_count + 1,
              updated_at = NOW()
            RETURNING request_count
          `,
          [
            req.tenant.id,
            endpointPattern,
            method,
            identifier,
            windowStart,
            windowEnd
          ]
        );

        const requestCount = parseInt(trackingResult.rows[0].request_count, 10);

        if (requestCount > requestsPerWindow) {
          // Clean up old tracking entries
          await client.query(
            `
              DELETE FROM shared.rate_limit_tracking
              WHERE window_end < NOW() - INTERVAL '1 hour'
            `
          );

          return res.status(429).json({
            message: 'Rate limit exceeded',
            limit: requestsPerWindow,
            window: `${windowSeconds}s`,
            retryAfter: windowSeconds
          });
        }

        // Add rate limit info to headers
        res.setHeader('X-RateLimit-Limit', requestsPerWindow.toString());
        res.setHeader('X-RateLimit-Remaining', Math.max(0, requestsPerWindow - requestCount).toString());
        res.setHeader('X-RateLimit-Reset', windowEnd.getTime().toString());

        next();
      } finally {
        client.release();
      }
    } catch (error) {
      next(error);
    }
  };
}

