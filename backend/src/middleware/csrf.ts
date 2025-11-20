import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_TOKEN_COOKIE = 'csrf-token';

/**
 * Generate a CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * CSRF protection middleware
 * Only applies to state-changing methods (POST, PUT, PATCH, DELETE)
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for health checks and public endpoints
  if (req.path === '/health' || req.path.startsWith('/auth/login') || req.path.startsWith('/auth/signup')) {
    return next();
  }

  // Get token from header
  const tokenFromHeader = req.headers[CSRF_TOKEN_HEADER] as string | undefined;
  
  // Get token from cookie (set by frontend)
  const tokenFromCookie = req.cookies?.[CSRF_TOKEN_COOKIE];

  if (!tokenFromHeader || !tokenFromCookie) {
    return res.status(403).json({
      message: 'CSRF token missing',
      code: 'CSRF_TOKEN_MISSING'
    });
  }

  // Compare tokens using constant-time comparison
  if (!crypto.timingSafeEqual(Buffer.from(tokenFromHeader), Buffer.from(tokenFromCookie))) {
    return res.status(403).json({
      message: 'CSRF token mismatch',
      code: 'CSRF_TOKEN_MISMATCH'
    });
  }

  next();
}

/**
 * Middleware to set CSRF token cookie
 * Uses non-httpOnly cookie so frontend can read it for header submission
 * This follows the double-submit cookie pattern
 */
export function setCsrfToken(req: Request, res: Response, next: NextFunction) {
  // Only set token for GET requests to avoid unnecessary cookie setting
  if (req.method === 'GET' && !req.cookies?.[CSRF_TOKEN_COOKIE]) {
    const token = generateCsrfToken();
    // Non-httpOnly cookie so frontend JavaScript can read it
    // Security: Token is validated against header, and SameSite=Strict prevents CSRF
    // Enforce HTTPS-only cookies in production
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie(CSRF_TOKEN_COOKIE, token, {
      httpOnly: false, // Allow JavaScript to read for header submission
      secure: isProduction, // HTTPS-only in production
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      // Additional security headers
      ...(isProduction && {
        // In production, ensure cookie is only sent over HTTPS
        secure: true
      })
    });
  }
  next();
}

