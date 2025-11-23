import { Request, Response, NextFunction } from 'express';
import { recordAuditLog, recordSharedAuditLog, type AuditEntityType } from '../services/auditLogService';
import { logger } from '../lib/logger';

/**
 * Middleware to audit all admin and superuser actions
 */
export function auditAdminActions(req: Request, res: Response, next: NextFunction) {
  const originalSend = res.send;
  const user = req.user;
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  
  // Only audit admin/superuser actions
  if (!isAdmin || !user) {
    return next();
  }

  // Only audit state-changing methods
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (!isStateChanging) {
    return next();
  }

  // Capture response
  res.send = function (body) {
    const statusCode = res.statusCode;
    const isSuccess = statusCode >= 200 && statusCode < 300;

    // Audit the action asynchronously (don't block response)
    setImmediate(async () => {
      try {
        const action = `${req.method} ${req.path}`;
        const entityType = determineEntityType(req.path);
        const entityId = extractEntityId(req.params, req.body);
        
        const auditDetails = {
          method: req.method,
          path: req.path,
          statusCode,
          success: isSuccess,
          body: sanitizeAuditBody(req.body),
          params: req.params,
          query: req.query,
          ip: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent']
        };

        if (user.role === 'superadmin') {
          await recordSharedAuditLog({
            userId: user.id,
            action,
            entityType,
            entityId,
            details: auditDetails,
            actorRole: user.role
          });
        } else {
          if (req.tenantClient && req.tenant) {
            await recordAuditLog(req.tenantClient, req.tenant.schema, {
              userId: user.id,
              action,
              entityType,
              entityId,
              details: auditDetails,
              actorRole: user.role
            });
          }
        }
      } catch (error) {
        // Log error but don't fail the request
        logger.error({ err: error }, '[auditAdminActions] Failed to record audit log');
      }
    });

    return originalSend.call(this, body);
  };

  next();
}

/**
 * Determine entity type from path
 */
function determineEntityType(path: string): AuditEntityType {
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return 'ACCESS';
  
  const resource = segments[segments.length - 1];
  const entityMap: Record<string, AuditEntityType> = {
    users: 'USER',
    students: 'STUDENT',
    teachers: 'USER',
    schools: 'TENANT',
    classes: 'CLASS',
    subjects: 'SUBJECT',
    exams: 'EXAM',
    grades: 'GRADE',
    attendance: 'ATTENDANCE',
    invoices: 'INVOICE',
    payments: 'INVOICE',
    configuration: 'TENANT',
    branding: 'TENANT'
  };
  
  return entityMap[resource] ?? 'ACCESS';
}

/**
 * Extract entity ID from params or body
 */
function extractEntityId(params: Record<string, string>, body: Record<string, unknown>): string | null {
  // Try common ID parameter names
  const idParams = ['id', 'userId', 'studentId', 'teacherId', 'schoolId', 'tenantId', 'classId', 'subjectId'];
  
  for (const param of idParams) {
    if (params[param]) return params[param];
    if (body[param] && typeof body[param] === 'string') return body[param] as string;
  }
  
  return null;
}

/**
 * Sanitize body for audit logs (remove sensitive data)
 */
function sanitizeAuditBody(body: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'accessToken', 'refreshToken'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

