import { z } from 'zod';

/**
 * Validation schemas for superuser investigation endpoints
 */

export const createCaseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(5000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  caseType: z.enum(['anomaly', 'security', 'compliance', 'abuse', 'other']),
  relatedUserId: z.string().uuid().optional(),
  relatedTenantId: z.string().uuid().nullable().optional(),
  assignedTo: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const updateCaseStatusSchema = z.object({
  status: z.enum(['open', 'investigating', 'resolved', 'closed']),
  resolution: z.string().max(1000).optional(),
  resolutionNotes: z.string().max(5000).optional()
});

export const addCaseNoteSchema = z.object({
  note: z.string().min(1, 'Note is required').max(5000),
  noteType: z.enum(['note', 'finding', 'evidence', 'action']).optional().default('note'),
  metadata: z.record(z.unknown()).optional()
});

export const addCaseEvidenceSchema = z.object({
  evidenceType: z.enum(['audit_log', 'session', 'login_attempt', 'password_change', 'file', 'other']),
  evidenceId: z.string().min(1, 'Evidence ID is required'),
  evidenceSource: z.string().min(1, 'Evidence source is required'),
  description: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const caseFiltersQuerySchema = z.object({
  status: z.enum(['open', 'investigating', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  caseType: z.enum(['anomaly', 'security', 'compliance', 'abuse', 'other']).optional(),
  relatedUserId: z.string().uuid().optional(),
  relatedTenantId: z.string().uuid().nullable().optional(),
  assignedTo: z.string().uuid().optional(),
  createdBy: z.string().uuid().optional(),
  tags: z.string().optional().transform((val) => val ? val.split(',') : undefined),
  startDate: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
  endDate: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
  limit: z.string().regex(/^\d+$/).optional().transform((val) => val ? parseInt(val, 10) : undefined),
  offset: z.string().regex(/^\d+$/).optional().transform((val) => val ? parseInt(val, 10) : undefined)
});

export const anomalyDetectionQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  tenantId: z.string().uuid().nullable().optional(),
  startDate: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
  endDate: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined)
});

export const userActionsQuerySchema = z.object({
  tenantId: z.string().uuid().nullable().optional(),
  startDate: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
  endDate: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
  limit: z.string().regex(/^\d+$/).optional().transform((val) => val ? parseInt(val, 10) : undefined),
  offset: z.string().regex(/^\d+$/).optional().transform((val) => val ? parseInt(val, 10) : undefined)
});

export const exportAuditTrailQuerySchema = z.object({
  format: z.enum(['csv', 'pdf', 'json']).optional().default('json')
});

