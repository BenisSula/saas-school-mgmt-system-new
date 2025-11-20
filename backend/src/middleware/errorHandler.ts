/**
 * Enhanced Error Handler with Error Tracking
 */

import { Request, Response, NextFunction } from 'express';
import { errorTracker } from '../services/monitoring/errorTracking';
import { metrics } from './metrics';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  field?: string;
  apiError?: {
    message: string;
    field?: string;
    code?: string;
  };
}

export function errorHandler(
  error: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Track error metrics (wrap in try-catch to prevent error handler from failing)
  const statusCode = error.statusCode || 500;
  const endpoint = req.path || 'unknown';
  try {
    metrics.incrementError(error.name || 'Error', endpoint, statusCode);
  } catch (metricsError) {
    console.error('[ErrorHandler] Failed to track error metrics:', metricsError);
  }

  // Capture error in tracking system (wrap in try-catch to prevent error handler from failing)
  try {
    errorTracker.captureException(error, {
      userId: (req as { user?: { id?: string } }).user?.id,
      tenantId: (req as { tenant?: { id?: string } }).tenant?.id,
      requestId: req.headers['x-request-id'] as string,
      userAgent: req.get('user-agent'),
      ip: req.ip,
      url: req.url,
      method: req.method
    });
  } catch (trackingError) {
    console.error('[ErrorHandler] Failed to capture error in tracking system:', trackingError);
  }

  // Log error
  console.error('[ErrorHandler]', {
    message: error.message,
    statusCode,
    endpoint,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });

  // Send error response
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(statusCode).json({
    message: error.message || 'Internal server error',
    code: error.code,
    field: error.field,
    ...(isDevelopment && { stack: error.stack })
  });
}
