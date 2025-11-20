import { z } from 'zod';

export const attendanceMarkSchema = z.object({
  studentId: z.string().uuid('Invalid student ID format'),
  classId: z.string().min(1, 'Class ID is required'),
  status: z.enum(['present', 'absent', 'late'], {
    message: 'Status must be present, absent, or late'
  }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  markedBy: z.string().uuid('Invalid user ID format').optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const attendanceMarksSchema = z.object({
  records: z.array(attendanceMarkSchema).min(1, 'At least one attendance record is required')
});

export const attendanceQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'From date must be in YYYY-MM-DD format').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'To date must be in YYYY-MM-DD format').optional(),
  classId: z.string().optional(),
  studentId: z.string().uuid('Invalid student ID format').optional()
}).passthrough();

export const studentIdParamSchema = z.object({
  studentId: z.string().uuid('Invalid student ID format')
});

export type AttendanceMarkInput = z.infer<typeof attendanceMarkSchema>;
export type AttendanceMarksInput = z.infer<typeof attendanceMarksSchema>;

