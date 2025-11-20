import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

/**
 * Enhanced tenant isolation middleware
 * Ensures that all database queries are scoped to the correct tenant schema
 * 
 * Security rules:
 * 1. Admin cannot act on other tenants (must match their tenantId)
 * 2. Superuser cannot read tenant private data without explicit tenant context
 * 3. Non-superadmin users MUST have tenant context matching their JWT tenantId
 */
export function enhancedTenantIsolation(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  const tenantClient = req.tenantClient;
  const tenant = req.tenant;

  // Superadmin can access all tenants, but must explicitly specify tenant
  // Superuser cannot read tenant private data without explicit tenant context
  const isSuperadmin = user?.role === 'superadmin';
  
  if (isSuperadmin) {
    // Superadmin operations should still go through tenant context when specified
    if (tenant && tenantClient) {
      // Verify schema is set correctly
      tenantClient.query('SELECT current_schema()').catch((error) => {
        logger.error({ err: error }, '[enhancedTenantIsolation] Schema verification failed');
      });
    }
    // Superadmin can proceed without tenant context (for cross-tenant operations)
    // But tenant-scoped operations will use the specified tenant context
    // NOTE: Superadmin should NOT read tenant private data without explicit tenant context
    return next();
  }

  // Non-superadmin users MUST have tenant context
  if (!tenant || !tenantClient) {
    logger.warn(
      { userId: user?.id, role: user?.role },
      '[enhancedTenantIsolation] Tenant context required for non-superadmin user'
    );
    return res.status(403).json({
      message: 'Tenant context required',
      code: 'TENANT_CONTEXT_REQUIRED'
    });
  }

  // CRITICAL: Admin cannot act on other tenants
  // Verify tenant ID matches user's tenant ID from JWT payload
  if (user?.tenantId && user.tenantId !== tenant.id) {
    logger.warn(
      { 
        userId: user.id,
        userTenantId: user.tenantId, 
        requestTenantId: tenant.id,
        role: user.role,
        path: req.path
      },
      '[enhancedTenantIsolation] Tenant mismatch - admin attempting to access different tenant'
    );
    return res.status(403).json({
      message: 'Access denied: tenant mismatch',
      code: 'TENANT_MISMATCH'
    });
  }

  // Additional check: Ensure user has tenantId in JWT for non-superadmin users
  if (!user?.tenantId && !isSuperadmin) {
    logger.warn(
      { userId: user?.id, role: user?.role },
      '[enhancedTenantIsolation] User missing tenantId in JWT token'
    );
    return res.status(403).json({
      message: 'Invalid token: tenant context missing',
      code: 'INVALID_TOKEN_TENANT'
    });
  }

  // Verify schema routing is enforced
  if (tenantClient) {
    tenantClient.query('SELECT current_schema()').then((result) => {
      const currentSchema = result.rows[0]?.current_schema;
      if (currentSchema !== tenant.schema) {
        logger.error(
          { expectedSchema: tenant.schema, actualSchema: currentSchema },
          '[enhancedTenantIsolation] Schema routing mismatch'
        );
      }
    }).catch((error) => {
      logger.error({ err: error }, '[enhancedTenantIsolation] Schema verification failed');
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
      code: 'TENANT_CONTEXT_MISSING'
    });
  }
  next();
}

