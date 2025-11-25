import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { formatValidationErrors } from '../lib/validationHelpers';

/**
 * Middleware to validate request body/query/params with Zod schema
 * Returns user-friendly error messages
 */
export function validateRequest<T extends z.ZodTypeAny>(
  schema: T,
  source: 'body' | 'query' | 'params' = 'body'
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
    const result = schema.safeParse(data);

    if (!result.success) {
      return res.status(400).json({
        message: formatValidationErrors(result.error),
        errors: result.error.issues,
      });
    }

    // Attach parsed data to request
    (req as { validated?: z.infer<T> }).validated = result.data;
    next();
  };
}
