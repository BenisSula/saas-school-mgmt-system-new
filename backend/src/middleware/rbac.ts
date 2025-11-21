import { Request, Response, NextFunction } from 'express';
import { Permission, Role, hasPermission } from '../config/permissions';
import { logUnauthorizedAttempt } from '../services/auditLogService';
import {
  FRIENDLY_FORBIDDEN_MESSAGE,
  FRIENDLY_MISSING_TARGET_ID,
  FRIENDLY_TENANT_CONTEXT_ERROR
} from '../lib/friendlyMessages';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: Role;
    tenantId: string;
    email: string;
    tokenId: string;
  };
}

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

/**
 * Requires the user to have one of the specified roles.
 * Superadmin is implicitly allowed if 'admin' is in the allowed roles.
 */
export function requireRole(allowedRoles: Role[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user as GuardedUser | undefined;
      if (!user) {
        return res.status(401).json({ message: 'Unauthenticated' });
      }

      const allowed = new Set<Role>(allowedRoles);

      if (allowed.has(user.role)) {
        return next();
      }

      // Superadmin is implicitly allowed if 'admin' is in allowed roles
      if (allowed.has('admin') && (user.role === 'admin' || user.role === 'superadmin')) {
        return next();
      }

      await logUnauthorizedAttempt(req.tenantClient, req.tenant?.schema, {
        userId: user.id,
        path: req.originalUrl ?? req.path,
        method: req.method,
        reason: 'Role not permitted',
        details: { allowedRoles, userRole: user.role }
      });

      return res.status(403).json({ message: FRIENDLY_FORBIDDEN_MESSAGE });
    } catch (error) {
      return next(error);
    }
  };
}

/**
 * Requires the user to have the specified permission.
 */
export function requirePermission(permission: Permission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role;

    if (!role || !hasPermission(role, permission)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    return next();
  };
}

/**
 * Allows access if the user is accessing their own resource OR has the required permission.
 * Superadmin always has access.
 * @param permission - Optional permission to check
 * @param idParam - Parameter name for the target user ID (default: 'studentId')
 */
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

      // Superadmin always has access
      if (user.role === 'superadmin') {
        return next();
      }

      // User accessing their own resource
      if (user.id === targetId) {
        return next();
      }

      // User has required permission
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

/**
 * Requires the user to have ANY of the specified permissions.
 * Allows access if user has at least one of the permissions.
 */
export function requireAnyPermission(...permissions: Permission[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role;

    if (!role) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Check if user has ANY of the specified permissions
    const hasAnyPermission = permissions.some((permission) => hasPermission(role, permission));

    if (!hasAnyPermission) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    return next();
  };
}

/**
 * Requires the user to have ALL of the specified permissions.
 * Allows access only if user has all permissions.
 */
export function requireAllPermissions(...permissions: Permission[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role;

    if (!role) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Check if user has ALL of the specified permissions
    const hasAllPermissions = permissions.every((permission) => hasPermission(role, permission));

    if (!hasAllPermissions) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    return next();
  };
}

/**
 * Requires the user to be a superadmin (superuser).
 * Only superadmin role can access SuperUser endpoints.
 */
export function requireSuperuser() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user as GuardedUser | undefined;

    if (!user) {
      return res.status(401).json({ message: 'Unauthenticated' });
    }

    if (user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Superuser access required' });
    }

    return next();
  };
}

/**
 * Enforces role hierarchy when modifying user roles.
 * Prevents lower-privileged users from assigning higher-privileged roles.
 * 
 * Role hierarchy (highest to lowest):
 * - superadmin
 * - admin
 * - hod
 * - teacher
 * - student
 * 
 * @param targetRoleParam - Parameter name for the target role being assigned (default: 'role')
 */
export function enforceRoleHierarchy(targetRoleParam = 'role') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user as GuardedUser | undefined;
      if (!user) {
        return res.status(401).json({ message: 'Unauthenticated' });
      }

      // Superadmin can assign any role
      if (user.role === 'superadmin') {
        return next();
      }

      const targetRole = req.body[targetRoleParam] || req.params[targetRoleParam] || req.query[targetRoleParam];
      
      if (!targetRole) {
        return next(); // No role assignment, skip check
      }

      // Define role hierarchy (higher number = higher privilege)
      const roleHierarchy: Record<Role, number> = {
        superadmin: 5,
        admin: 4,
        hod: 3,
        teacher: 2,
        student: 1
      };

      const userLevel = roleHierarchy[user.role] ?? 0;
      const targetLevel = roleHierarchy[targetRole as Role] ?? 0;

      // User cannot assign roles equal to or higher than their own
      if (targetLevel >= userLevel) {
        await logUnauthorizedAttempt(req.tenantClient, req.tenant?.schema, {
          userId: user.id,
          path: req.originalUrl ?? req.path,
          method: req.method,
          reason: 'Role hierarchy violation',
          details: {
            userRole: user.role,
            attemptedRole: targetRole,
            userLevel,
            targetLevel
          }
        });

        return res.status(403).json({
          message: 'Cannot assign role equal to or higher than your own'
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export default requireRole;

