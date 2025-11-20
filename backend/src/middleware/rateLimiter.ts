import rateLimit from 'express-rate-limit';
import { Request } from 'express';

/**
 * General API rate limiter - 100 requests per 15 minutes
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  }
});

/**
 * Strict rate limiter for authentication endpoints - 5 requests per 15 minutes
 */
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Don't count successful requests
});

/**
 * Admin/Superuser action rate limiter - 50 requests per minute
 */
export const adminActionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50,
  message: 'Too many admin actions, please slow down.',
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Stricter SuperUser rate limiter - 30 requests per minute
 * Applied to sensitive operations like password resets, session revocations
 */
export const superuserStrictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: 'Too many superuser actions, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false // Count all requests
});

/**
 * IP-based rate limiter for suspicious login attempts
 * Tracks failed login attempts per IP address
 */
export const suspiciousLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 failed attempts per 15 minutes
  message: 'Too many failed login attempts from this IP. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts
  keyGenerator: (req: Request) => {
    // Use IP address for tracking
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded
      ? (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0])
      : req.socket.remoteAddress || 'unknown';
    return `suspicious-login:${ip}`;
  }
});

/**
 * Write operation rate limiter - 20 requests per minute
 */
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: 'Too many write operations, please slow down.',
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Get client identifier for rate limiting
 */
export function getClientIdentifier(req: Request): string {
  // Use user ID if authenticated, otherwise use IP
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }
  
  // Get IP from various headers (for proxy/load balancer scenarios)
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded
    ? (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0])
    : req.socket.remoteAddress || 'unknown';
  
  return `ip:${ip}`;
}

