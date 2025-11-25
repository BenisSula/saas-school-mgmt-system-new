import { z } from 'zod';

export const subjectSchema = z.object({
  name: z.string().min(2),
  code: z
    .string()
    .trim()
    .min(1)
    .max(16)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  description: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type SubjectInput = z.infer<typeof subjectSchema>;

export const classSubjectAssignmentSchema = z.object({
  subjectIds: z.array(z.string().uuid()).min(1, 'At least one subject must be selected'),
});

export const teacherAssignmentSchema = z.object({
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  isClassTeacher: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const studentSubjectSchema = z.object({
  subjectIds: z.array(z.string().uuid()).min(1),
});

export const promotionSchema = z.object({
  toClassId: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

export const termReportSchema = z.object({
  studentId: z.string().uuid(),
  termId: z.string().uuid(),
  includeBreakdown: z.boolean().optional(),
});
