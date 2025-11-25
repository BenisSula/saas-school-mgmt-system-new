/**
 * Middleware to validate route parameters (IDs, UUIDs, etc.)
 * Ensures all IDs are properly validated before use
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

/**
 * UUID validation schema
 */
const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Integer ID validation schema
 */
const intIdSchema = z.string().regex(/^\d+$/, 'Invalid integer ID format').transform(Number);

/**
 * Validate route parameters
 * @param schema - Zod schema to validate params against
 */
export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.params);

      if (!result.success) {
        const errors = result.error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        return res.status(400).json({
          message: 'Invalid route parameters',
          errors,
          code: 'INVALID_PARAMS',
        });
      }

      // Replace params with validated data
      req.params = result.data as Record<string, string>;
      next();
    } catch (error) {
      console.error('[validateParams] Unexpected error:', error);
      return res.status(400).json({
        message: 'Invalid route parameters',
        code: 'INVALID_PARAMS',
      });
    }
  };
}

/**
 * Validate UUID parameter
 * @param paramName - Name of the parameter to validate (default: 'id')
 */
export function validateUuidParam(paramName: string = 'id') {
  return validateParams(
    z.object({
      [paramName]: uuidSchema,
    })
  );
}

/**
 * Validate integer ID parameter
 * @param paramName - Name of the parameter to validate (default: 'id')
 */
export function validateIntParam(paramName: string = 'id') {
  return validateParams(
    z.object({
      [paramName]: intIdSchema,
    })
  );
}

/**
 * Validate multiple UUID parameters
 */
export function validateUuidParams(...paramNames: string[]) {
  const schemaObject: Record<string, z.ZodString> = {};
  for (const name of paramNames) {
    schemaObject[name] = uuidSchema;
  }
  return validateParams(z.object(schemaObject));
}
