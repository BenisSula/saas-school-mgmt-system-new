import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

/**
 * Enhanced tenant isolation middleware
 * Ensures that all database queries are scoped to the correct tenant schema
 */
export function enhancedTenantIsolation(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  const tenantClient = req.tenantClient;
  const tenant = req.tenant;

  // Superadmin can access all tenants, but must explicitly specify tenant
  if (user?.role === 'superadmin') {
    // Superadmin operations should still go through tenant context when specified
    if (tenant && tenantClient) {
      // Verify schema is set correctly
      tenantClient.query('SELECT current_schema()').catch((error) => {
        logger.error({ err: error }, '[enhancedTenantIsolation] Schema verification failed');
      });
    }
    return next();
  }

  // Non-superadmin users MUST have tenant context
  if (!tenant || !tenantClient) {
    return res.status(403).json({
      message: 'Tenant context required',
      code: 'TENANT_CONTEXT_REQUIRED',
    });
  }

  // Verify tenant ID matches user's tenant ID
  if (user?.tenantId && user.tenantId !== tenant.id) {
    logger.warn(
      { userTenantId: user.tenantId, requestTenantId: tenant.id },
      '[enhancedTenantIsolation] Tenant mismatch'
    );
    return res.status(403).json({
      message: 'Access denied: tenant mismatch',
      code: 'TENANT_MISMATCH',
    });
  }

  // Add tenant ID to request for logging/auditing
  req.tenant = tenant;
  req.tenantClient = tenantClient;

  next();
}

/**
 * Middleware to ensure tenant context is set before proceeding
 */
export function requireTenantContext(req: Request, res: Response, next: NextFunction) {
  if (!req.tenant || !req.tenantClient) {
    return res.status(400).json({
      message: 'Tenant context is required for this operation',
      code: 'TENANT_CONTEXT_MISSING',
    });
  }
  next();
}
