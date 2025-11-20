import type { Request, Response, NextFunction } from 'express';
import { getPool } from '../db/pool';
import { isFeatureEnabled } from '../services/featureFlags/featureFlagService';

/**
 * Middleware to check feature flag before allowing access
 */
export function requireFeatureFlag(flagKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pool = getPool();
      const client = await pool.connect();

      try {
        const tenantId = req.tenant?.id || req.user?.tenantId;
        const enabled = await isFeatureEnabled(client, flagKey, tenantId);

        if (!enabled) {
          return res.status(403).json({
            message: 'Feature not available',
            flagKey
          });
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

/**
 * Middleware to add feature flag status to request object
 */
export async function addFeatureFlags(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const pool = getPool();
    const client = await pool.connect();

    try {
      const tenantId = req.tenant?.id || req.user?.tenantId;
      
      // Add common feature flags to request
      req.featureFlags = {
        advancedAnalytics: await isFeatureEnabled(client, 'advanced_analytics', tenantId),
        sso: await isFeatureEnabled(client, 'sso', tenantId),
        mobileApp: await isFeatureEnabled(client, 'mobile_app', tenantId),
        aiInsights: await isFeatureEnabled(client, 'ai_insights', tenantId)
      };

      next();
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      featureFlags?: {
        advancedAnalytics?: boolean;
        sso?: boolean;
        mobileApp?: boolean;
        aiInsights?: boolean;
        [key: string]: boolean | undefined;
      };
    }
  }
}

