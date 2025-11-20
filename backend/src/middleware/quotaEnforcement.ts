import type { Request, Response, NextFunction } from 'express';
import { getPool } from '../db/pool';
import { checkQuota, incrementQuotaUsage, type ResourceType } from '../services/quotas/quotaService';

/**
 * Middleware to enforce quota limits
 */
export function enforceQuota(resourceType: ResourceType, amount: number = 1) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.tenant?.id) {
        return res.status(500).json({ message: 'Tenant context missing' });
      }

      const pool = getPool();
      const client = await pool.connect();

      try {
        // Check quota
        const quotaResult = await checkQuota(client, req.tenant.id, resourceType, amount);

        if (!quotaResult.allowed) {
          return res.status(429).json({
            message: 'Quota exceeded',
            resourceType,
            limit: quotaResult.remaining,
            retryAfter: 'next reset period'
          });
        }

        // Increment usage
        await incrementQuotaUsage(client, req.tenant.id, resourceType, amount);

        // Add quota info to response headers
        res.setHeader('X-Quota-Remaining', quotaResult.remaining.toString());
        if (quotaResult.warning) {
          res.setHeader('X-Quota-Warning', 'true');
        }

        next();
      } finally {
        client.release();
      }
    } catch (error) {
      next(error);
    }
  };
}

