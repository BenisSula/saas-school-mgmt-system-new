import { Request, Response, NextFunction } from 'express';

const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Request timeout middleware
 * Prevents requests from hanging indefinitely
 */
export function requestTimeout(timeoutMs: number = DEFAULT_TIMEOUT) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({
          message: 'Request timeout',
          code: 'REQUEST_TIMEOUT'
        });
      }
    }, timeoutMs);

    // Clear timeout when response is sent
    res.on('finish', () => {
      clearTimeout(timeout);
    });

    next();
  };
}

