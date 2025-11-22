/**
 * Context Validation Helpers
 * DRY principle: Consolidates repeated context validation patterns
 */

import { Request, Response } from 'express';
import { verifyTenantAndUserContext } from '../services/shared/adminHelpers';
import { createErrorResponse } from './responseHelpers';

/**
 * Validates tenant and user context, returns early with error if invalid
 * Returns the validated tenant, tenantClient, and user if valid
 */
export function validateContextOrRespond(
  req: Request,
  res: Response
): { tenant: NonNullable<Request['tenant']>; tenantClient: NonNullable<Request['tenantClient']>; user: NonNullable<Request['user']> } | null {
  const contextCheck = verifyTenantAndUserContext(req.tenant, req.tenantClient, req.user);
  if (!contextCheck.isValid) {
    res.status(500).json(createErrorResponse(contextCheck.error!));
    return null;
  }

  // TypeScript: After validation, we know these are defined
  return {
    tenant: req.tenant!,
    tenantClient: req.tenantClient!,
    user: req.user!
  };
}

