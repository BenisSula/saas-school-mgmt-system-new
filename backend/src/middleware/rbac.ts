import { Request, Response, NextFunction } from 'express';

export type Role = 'student' | 'teacher' | 'admin' | 'superadmin';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: Role;
    tenantId: string;
  };
}

export function requireRole(allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role;

    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    return next();
  };
}

export default requireRole;

