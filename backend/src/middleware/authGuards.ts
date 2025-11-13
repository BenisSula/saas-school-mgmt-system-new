import { Request, Response, NextFunction } from 'express';
import { Permission, Role, hasPermission } from '../config/permissions';
import { logUnauthorizedAttempt } from '../services/auditLogService';
import {
  FRIENDLY_FORBIDDEN_MESSAGE,
  FRIENDLY_MISSING_TARGET_ID,
  FRIENDLY_TENANT_CONTEXT_ERROR
} from '../lib/friendlyMessages';

interface GuardedUser {
  id: string;
  role: Role;
  tenantId: string;
  email: string;
  tokenId: string;
}

function hasRequiredPermission(user: GuardedUser, permission: Permission | undefined): boolean {
  if (!permission) {
    return false;
  }
  return hasPermission(user.role, permission);
}

export function requireSelfOrPermission(permission?: Permission, idParam = 'studentId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as GuardedUser | undefined;
      if (!user) {
        return res.status(401).json({ message: 'Unauthenticated' });
      }

      const targetId =
        (req.params && req.params[idParam]) ||
        (req.body && (req.body[idParam] as string | undefined)) ||
        (req.query && (req.query[idParam] as string | undefined));

      if (!targetId) {
        return res.status(400).json({ message: FRIENDLY_MISSING_TARGET_ID });
      }

      if (user.role === 'superadmin') {
        return next();
      }

      if (user.id === targetId) {
        return next();
      }

      if (hasRequiredPermission(user, permission)) {
        return next();
      }

      await logUnauthorizedAttempt(req.tenantClient, req.tenant?.schema, {
        userId: user.id,
        entityId: targetId,
        path: req.originalUrl ?? req.path,
        method: req.method,
        reason: permission ? `Missing permission: ${permission}` : 'Self-access denied'
      });

      if (!req.tenantClient || !req.tenant) {
        return res.status(500).json({ message: FRIENDLY_TENANT_CONTEXT_ERROR });
      }

      return res.status(403).json({ message: FRIENDLY_FORBIDDEN_MESSAGE });
    } catch (error) {
      return next(error);
    }
  };
}

export function requireRoleGuard(roles: Role[] = []) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as GuardedUser | undefined;
      if (!user) {
        return res.status(401).json({ message: 'Unauthenticated' });
      }

      const allowed = new Set<Role>(roles);

      if (allowed.has(user.role)) {
        return next();
      }

      if (allowed.has('admin') && (user.role === 'admin' || user.role === 'superadmin')) {
        return next();
      }

      await logUnauthorizedAttempt(req.tenantClient, req.tenant?.schema, {
        userId: user.id,
        path: req.originalUrl ?? req.path,
        method: req.method,
        reason: 'Role not permitted',
        details: { allowedRoles: roles, userRole: user.role }
      });

      return res.status(403).json({ message: FRIENDLY_FORBIDDEN_MESSAGE });
    } catch (error) {
      return next(error);
    }
  };
}
