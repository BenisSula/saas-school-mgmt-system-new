/**
 * Audit Log Helper Utilities
 * Provides safe, consistent audit logging with error handling
 */

import type { PoolClient } from 'pg';
import { createAuditLog } from '../services/audit/enhancedAuditService';
import { logger } from './logger';

export interface AuditLogParams {
  tenantId: string;
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  severity?: 'info' | 'warning' | 'error' | 'critical';
}

/**
 * Safely create an audit log entry.
 * Catches and logs errors without throwing, ensuring audit log failures
 * don't break the main operation.
 *
 * @param client - Database client (tenant-scoped)
 * @param params - Audit log parameters
 * @param routeContext - Optional route context for error logging (e.g., 'students', 'teachers')
 */
export async function safeAuditLog(
  client: PoolClient | null | undefined,
  params: AuditLogParams,
  routeContext?: string
): Promise<void> {
  if (!client) {
    logger.warn(
      { routeContext, action: params.action },
      'Cannot create audit log: database client missing'
    );
    return;
  }

  try {
    await createAuditLog(client, {
      tenantId: params.tenantId,
      userId: params.userId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      details: params.details || {},
      severity: params.severity || 'info',
    });
  } catch (auditError) {
    const context = routeContext ? `[${routeContext}]` : '[audit]';
    logger.error(
      {
        routeContext,
        action: params.action,
        error: auditError instanceof Error ? auditError.message : String(auditError),
      },
      `${context} Failed to create audit log`
    );
  }
}

/**
 * Create audit log from Express request context.
 * Extracts tenant, user, and client from request automatically.
 *
 * @param req - Express request with tenant and user context
 * @param params - Audit log parameters (tenantId, userId, client will be extracted from req)
 * @param routeContext - Optional route context for error logging
 */
export async function safeAuditLogFromRequest(
  req: {
    tenant?: { id: string };
    user?: { id: string; email: string; role: string };
    tenantClient?: PoolClient | null;
  },
  params: Omit<AuditLogParams, 'tenantId' | 'userId'> & {
    tenantId?: string;
    userId?: string;
  },
  routeContext?: string
): Promise<void> {
  if (!req.tenant || !req.user || !req.tenantClient) {
    return;
  }

  await safeAuditLog(
    req.tenantClient,
    {
      tenantId: params.tenantId || req.tenant.id,
      userId: params.userId || req.user.id,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      details: {
        ...params.details,
        updatedBy: req.user.email,
        role: req.user.role,
      },
      severity: params.severity,
    },
    routeContext
  );
}
