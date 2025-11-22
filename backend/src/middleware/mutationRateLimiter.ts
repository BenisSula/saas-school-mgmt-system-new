/**
 * Mutation Rate Limiter
 * Specialized rate limiters for mutation endpoints (POST, PUT, PATCH, DELETE)
 */

import rateLimit from 'express-rate-limit';
import { Request } from 'express';

/**
 * Standard mutation rate limiter - 30 requests per minute per user
 * Applied to all POST, PUT, PATCH, DELETE operations
 */
export const mutationRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: 'Too many mutation requests. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise use IP
    if (req.user?.id) {
      return `mutation:user:${req.user.id}`;
    }
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded
      ? (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0])
      : req.socket.remoteAddress || 'unknown';
    return `mutation:ip:${ip}`;
  },
  skip: (req: Request) => {
    // Skip for GET requests (read-only)
    return req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
  }
});

/**
 * Bulk operation rate limiter - 10 requests per minute
 * For operations that process multiple records (bulk updates, exports, etc.)
 */
export const bulkOperationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many bulk operations. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    if (req.user?.id) {
      return `bulk:user:${req.user.id}`;
    }
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded
      ? (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0])
      : req.socket.remoteAddress || 'unknown';
    return `bulk:ip:${ip}`;
  }
});

/**
 * File upload rate limiter - 5 requests per minute
 * For file upload operations
 */
export const fileUploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: 'Too many file uploads. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    if (req.user?.id) {
      return `upload:user:${req.user.id}`;
    }
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded
      ? (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0])
      : req.socket.remoteAddress || 'unknown';
    return `upload:ip:${ip}`;
  }
});

/**
 * Export rate limiter - 3 requests per minute
 * For report export operations (can be resource-intensive)
 */
export const exportLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3,
  message: 'Too many export requests. Please wait before exporting again.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    if (req.user?.id) {
      return `export:user:${req.user.id}`;
    }
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded
      ? (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0])
      : req.socket.remoteAddress || 'unknown';
    return `export:ip:${ip}`;
  }
});

/**
 * Attendance marking rate limiter - 20 requests per minute
 * For attendance operations (can be frequent but should be controlled)
 */
export const attendanceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: 'Too many attendance operations. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    if (req.user?.id) {
      return `attendance:user:${req.user.id}`;
    }
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded
      ? (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0])
      : req.socket.remoteAddress || 'unknown';
    return `attendance:ip:${ip}`;
  }
});

