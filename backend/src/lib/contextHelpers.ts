/**
 * Context Validation Helpers
 * DRY principle: Consolidates repeated context validation patterns
 * 
 * CONSOLIDATED: This is the canonical file for context validation.
 * 
 * CANONICAL REASON: Returns object with validated context (more flexible than boolean return pattern)
 * 
 * DUPLICATES TO DEPRECATE:
 * - backend/src/lib/routeHelpers.ts:15-21 (requireTenantContext - returns boolean)
 * - backend/src/lib/routeHelpers.ts:26-32 (requireUserContext - returns boolean)
 * - backend/src/lib/routeHelpers.ts:37-39 (requireContext - returns boolean)
 * 
 * DIFFERENCES:
 * - contextHelpers.ts: Returns {tenant, tenantClient, user} | null (more flexible)
 * - routeHelpers.ts: Returns boolean (less flexible, but used in 4 files)
 * - DECISION: Keep contextHelpers.ts as canonical, routeHelpers functions will use it internally
 * 
 * STATUS: ✅ COMPLETE - Canonical file ready
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

