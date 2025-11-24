import { Request, Response, NextFunction } from 'express';
import { isSuperuser } from '../lib/superuserHelpers';

/**
 * Middleware to authorize superuser (superadmin) access
 * Must be used after authenticate middleware
 */
export function authorizeSuperUser(req: Request, res: Response, next: NextFunction) {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!isSuperuser(user.role)) {
    return res.status(403).json({ message: 'Superuser authority required' });
  }

  return next();
}

export default authorizeSuperUser;
