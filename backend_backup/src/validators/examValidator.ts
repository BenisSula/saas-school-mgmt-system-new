import { z } from 'zod';

export const examSchema = z.object({
  name: z.string().min(1, 'Exam name is required'),
  description: z.string().optional(),
  examDate: z.string().date('Invalid exam date').optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const examSessionSchema = z.object({
  classId: z.string().min(1, 'Class identifier is required'),
  subject: z.string().min(1, 'Subject is required'),
  scheduledAt: z.string().datetime('Invalid scheduled date'),
  invigilator: z.string().optional()
});

export const gradeEntrySchema = z.object({
  studentId: z.string().uuid('studentId must be a UUID'),
  subject: z.string().min(1, 'Subject is required'),
  score: z.number().min(0, 'Score must be non-negative'),
  remarks: z.string().optional(),
  classId: z.string().optional()
});

export const gradeBulkSchema = z.object({
  examId: z.string().uuid('examId must be a UUID'),
  entries: z.array(gradeEntrySchema).min(1, 'At least one grade entry is required')
});
