import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '../config/permissions';

export interface JwtPayload {
  sub: string;
  tenantId: string | '';
  role: Role;
  email: string;
  tokenId: string;
  exp: number;
  iat: number;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      tenantId: string;
      role: Role;
      email: string;
      tokenId: string;
    };
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.slice(7);

  try {
    const secret = process.env.JWT_ACCESS_SECRET ?? 'change-me-access';
    const payload = jwt.verify(token, secret) as JwtPayload;

    // SECURITY: Verify token expiration explicitly
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return res.status(401).json({ message: 'Token has expired' });
    }

    req.user = {
      id: payload.sub,
      tenantId: payload.tenantId || '',
      role: payload.role,
      email: payload.email,
      tokenId: payload.tokenId,
    };

    return next();
  } catch (error) {
    // SECURITY: Provide more specific error messages for debugging (but don't leak sensitive info)
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: 'Token has expired' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export default authenticate;
