import { Role } from '../config/permissions';
import { Request } from 'express';

/**
 * Check if a role has superuser authority
 */
export function isSuperuser(role: Role | string): boolean {
  return role === 'superadmin';
}

/**
 * Validate that the requesting user is a superuser
 * Throws an error if not authorized
 */
export function requireSuperuser(role: Role | string | undefined): void {
  if (!role || !isSuperuser(role)) {
    throw new Error('Superuser authority required');
  }
}

/**
 * Extract user agent from request
 */
export function extractUserAgent(req: Request): string | null {
  return req.headers['user-agent'] || null;
}

/**
 * Parse device info from user agent (basic implementation)
 * In production, use a library like 'ua-parser-js'
 */
export function parseDeviceInfo(userAgent: string | null): Record<string, unknown> {
  if (!userAgent) {
    return {};
  }

  const info: Record<string, unknown> = {};

  // Basic device detection
  if (/mobile|android|iphone|ipad/i.test(userAgent)) {
    info.deviceType = 'mobile';
  } else if (/tablet|ipad/i.test(userAgent)) {
    info.deviceType = 'tablet';
  } else {
    info.deviceType = 'desktop';
  }

  // Browser detection
  if (/chrome/i.test(userAgent) && !/edge/i.test(userAgent)) {
    info.browser = 'Chrome';
  } else if (/firefox/i.test(userAgent)) {
    info.browser = 'Firefox';
  } else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
    info.browser = 'Safari';
  } else if (/edge/i.test(userAgent)) {
    info.browser = 'Edge';
  }

  // OS detection
  if (/windows/i.test(userAgent)) {
    info.os = 'Windows';
  } else if (/mac/i.test(userAgent)) {
    info.os = 'macOS';
  } else if (/linux/i.test(userAgent)) {
    info.os = 'Linux';
  } else if (/android/i.test(userAgent)) {
    info.os = 'Android';
  } else if (/ios|iphone|ipad/i.test(userAgent)) {
    info.os = 'iOS';
  }

  return info;
}

