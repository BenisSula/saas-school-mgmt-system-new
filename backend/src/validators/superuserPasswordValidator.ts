import { z } from 'zod';

/**
 * Validation schemas for superuser password management endpoints
 */

export const resetPasswordParamsSchema = z.object({
  userId: z.string().uuid(),
});

export const resetPasswordBodySchema = z.object({
  reason: z.string().optional(),
});

export const changePasswordParamsSchema = z.object({
  userId: z.string().uuid(),
});

export const changePasswordBodySchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters long'),
  reason: z.string().optional(),
});

export const passwordHistoryParamsSchema = z.object({
  userId: z.string().uuid(),
});

export const passwordHistoryQuerySchema = z.object({
  tenantId: z
    .string()
    .uuid()
    .optional()
    .transform((val) => (val === 'null' || val === '' ? null : val)),
  changeType: z.enum(['self_reset', 'admin_reset', 'admin_change', 'forced_reset']).optional(),
  startDate: z
    .string()
    .datetime()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  endDate: z
    .string()
    .datetime()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  limit: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  offset: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
});
