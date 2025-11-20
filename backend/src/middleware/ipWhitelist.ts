import type { Request, Response, NextFunction } from 'express';
import { getPool } from '../db/pool';
import { isIpWhitelisted } from '../services/security/ipWhitelistService';

/**
 * Middleware to enforce IP whitelisting for tenants
 */
export async function enforceIpWhitelist(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.tenant?.id) {
      res.status(500).json({ message: 'Tenant context missing' });
      return;
    }

    // Get IP address
    const forwarded = req.headers['x-forwarded-for'];
    const ipAddress = forwarded
      ? (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0])
      : req.socket.remoteAddress || req.ip || 'unknown';

    const pool = getPool();
    const client = await pool.connect();

    try {
      const allowed = await isIpWhitelisted(client, req.tenant.id, ipAddress);

      if (!allowed) {
        res.status(403).json({
          message: 'IP address not whitelisted',
          ipAddress
        });
        return;
      }

      next();
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
}

