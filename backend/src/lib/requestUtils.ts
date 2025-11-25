/**
 * Request Utilities
 * Canonical implementation for request-related utilities (IP extraction, client identification)
 *
 * CONSOLIDATED: This file consolidates IP extraction logic from:
 * - backend/src/lib/superuserHelpers.ts (extractIpAddress - most comprehensive)
 * - backend/src/middleware/rateLimiter.ts (getClientIdentifier)
 * - backend/src/middleware/mutationRateLimiter.ts (inline IP extraction)
 * - backend/src/middleware/ipWhitelist.ts (inline IP extraction)
 * - backend/src/middleware/rateLimitPerTenant.ts (simple IP extraction)
 *
 * STATUS: ✅ COMPLETE - Canonical file ready
 */

import type { Request } from 'express';

/**
 * Extract IP address from request
 * Handles proxy headers (x-forwarded-for, x-real-ip)
 *
 * Source: backend/src/lib/superuserHelpers.ts:25-38 (most comprehensive implementation)
 */
export function extractIpAddress(req: Request): string | null {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0];
    return ips.trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  return req.ip || req.socket.remoteAddress || null;
}

/**
 * Get client identifier for rate limiting
 * Uses user ID if authenticated, otherwise uses IP address
 *
 * Source: backend/src/middleware/rateLimiter.ts:90-103
 */
export function getClientIdentifier(req: Request): string {
  // Use user ID if authenticated, otherwise use IP
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }

  const ip = extractIpAddress(req);
  return `ip:${ip || 'unknown'}`;
}
