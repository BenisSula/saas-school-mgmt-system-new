import { Request, Response, NextFunction } from 'express';

/**
 * Cache control middleware
 */
export function setCacheControl(maxAge: number, isPrivate = false) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const cacheControl = isPrivate
      ? `private, max-age=${maxAge}`
      : `public, max-age=${maxAge}`;
    
    res.set('Cache-Control', cacheControl);
    res.set('Vary', 'Accept, Authorization');
    next();
  };
}

/**
 * No cache middleware for sensitive data
 */
export function noCache(_req: Request, res: Response, next: NextFunction) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
}

/**
 * Cache policies for different endpoint types
 */
export const cachePolicies = {
  // Public data - 5 minutes
  public: setCacheControl(300, false),
  
  // User-specific data - 1 minute
  user: setCacheControl(60, true),
  
  // Admin data - 30 seconds
  admin: setCacheControl(30, true),
  
  // Sensitive data - no cache
  sensitive: noCache
};

