import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

/**
 * Middleware to validate request body, query, or params against a Zod schema
 */
export function validateInput<T extends z.ZodTypeAny>(
  schema: T,
  source: 'body' | 'query' | 'params' = 'body'
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      let data = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
      
      // For query parameters, handle arrays and ensure proper format
      if (source === 'query' && data) {
        const queryData: Record<string, string> = {};
        for (const key in data) {
          const value = data[key];
          // If value is an array, take the first element (Express behavior)
          queryData[key] = Array.isArray(value) ? (value[0] || '') : (value || '');
        }
        data = queryData;
      }
      
      const result = schema.safeParse(data);
      
      if (!result.success) {
        const errors = result.error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        
        return res.status(400).json({
          message: 'Validation failed',
          errors,
          code: 'VALIDATION_ERROR'
        });
      }
      
      // Replace the original data with validated data
      if (source === 'body') {
        req.body = result.data;
      } else if (source === 'query') {
        req.query = result.data as Record<string, string>;
      } else {
        req.params = result.data as Record<string, string>;
      }
      
      next();
    } catch (error) {
      // Fallback error handling
      console.error('[validateInput] Unexpected error:', error);
      return res.status(400).json({
        message: 'Invalid input',
        code: 'INVALID_INPUT'
      });
    }
  };
}

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');
  
  // Remove script tags and event handlers
  sanitized = sanitized
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '');
  
  // Trim and limit length
  sanitized = sanitized.trim().slice(0, 10000);
  
  return sanitized;
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = { ...obj };
  
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = sanitizeString(sanitized[key] as string) as T[Extract<keyof T, string>];
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null && !Array.isArray(sanitized[key])) {
      sanitized[key] = sanitizeObject(sanitized[key] as Record<string, unknown>) as T[Extract<keyof T, string>];
    } else if (Array.isArray(sanitized[key])) {
      sanitized[key] = (sanitized[key] as unknown[]).map((item) =>
        typeof item === 'string' ? sanitizeString(item) : typeof item === 'object' && item !== null ? sanitizeObject(item as Record<string, unknown>) : item
      ) as T[Extract<keyof T, string>];
    }
  }
  
  return sanitized;
}

/**
 * Middleware to sanitize request body
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

