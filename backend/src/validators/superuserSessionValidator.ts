import { z } from 'zod';

/**
 * Validation schemas for superuser session and login history endpoints
 */

export const loginHistoryQuerySchema = z.object({
  tenantId: z
    .string()
    .uuid()
    .optional()
    .transform((val) => (val === 'null' || val === '' ? null : val)),
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
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
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

export const sessionsQuerySchema = z.object({
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

export const revokeSessionParamsSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string().uuid(),
});

export const revokeAllSessionsParamsSchema = z.object({
  userId: z.string().uuid(),
});

export const revokeAllSessionsBodySchema = z.object({
  exceptSessionId: z.string().uuid().optional(),
});
