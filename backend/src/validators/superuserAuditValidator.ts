import { z } from 'zod';

/**
 * Validation schemas for superuser audit log endpoints
 */

export const auditLogsQuerySchema = z.object({
  tenantId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  severity: z.enum(['info', 'warning', 'error', 'critical']).optional(),
  tags: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',') : undefined)),
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

export const auditLogsExportQuerySchema = auditLogsQuerySchema.extend({
  format: z.enum(['csv', 'json']).optional().default('json'),
});
