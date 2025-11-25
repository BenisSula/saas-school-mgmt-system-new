import { z } from 'zod';

/**
 * Validation schemas for login attempts endpoint
 */

export const loginAttemptsQuerySchema = z.object({
  email: z.string().email().optional(),
  userId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional()
    .transform((val) => val === 'null' || val === '' ? null : val),
  success: z.string().optional().transform((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return undefined;
  }),
  startDate: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
  endDate: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
  limit: z.string().optional().transform(Number).refine(val => !isNaN(val) && val > 0, {
    message: "Limit must be a positive number"
  }).optional(),
  offset: z.string().optional().transform(Number).refine(val => !isNaN(val) && val >= 0, {
    message: "Offset must be a non-negative number"
  }).optional(),
});

