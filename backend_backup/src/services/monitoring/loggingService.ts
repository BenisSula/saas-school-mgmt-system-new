/**
 * Centralized Logging Service
 * Structured logging for OpenSearch/ELK stack
 */

import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Extend Express Request type to include requestId
declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
  }
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export interface LogContext {
  userId?: string;
  tenantId?: string;
  requestId?: string;
  correlationId?: string;
  [key: string]: unknown;
}

class Logger {
  /**
   * Log message with context
   */
  log(level: LogLevel, message: string, context?: LogContext) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: 'backend',
      environment: process.env.NODE_ENV || 'development',
      ...context
    };

    // In production, send to OpenSearch/ELK
    // For now, use structured console logging
    const logMethod = level === LogLevel.ERROR ? console.error :
                      level === LogLevel.WARN ? console.warn :
                      level === LogLevel.DEBUG ? console.debug :
                      console.log;

    logMethod(JSON.stringify(logEntry));
  }

  debug(message: string, context?: LogContext) {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.log(LogLevel.ERROR, message, {
      ...context,
      error: {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      }
    });
  }
}

export const logger = new Logger();

/**
 * Express middleware for request logging
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();
  const start = Date.now();

  // Add request ID to request object
  req.requestId = requestId;

  // Log request
  logger.info('Request started', {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration
    });
  });

  next();
}

