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

    req.user = {
      id: payload.sub,
      tenantId: payload.tenantId || '',
      role: payload.role,
      email: payload.email,
      tokenId: payload.tokenId
    };

    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export default authenticate;
