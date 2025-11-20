import { z } from 'zod';

export const teacherSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  subjects: z.array(z.string()).default([]),
  assignedClasses: z.array(z.string()).default([]),
  qualifications: z.string().optional(),
  yearsOfExperience: z.number().int().min(0).optional()
});

export type TeacherInput = z.infer<typeof teacherSchema>;

