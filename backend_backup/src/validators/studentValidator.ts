import { z } from 'zod';

export const studentSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().optional(),
  classId: z.string().optional(),
  admissionNumber: z.string().optional(),
  parentContacts: z.array(
    z.object({
      name: z.string().min(1),
      relationship: z.string().min(1),
      phone: z.string().min(5)
    })
  ).optional()
});

export type StudentInput = z.infer<typeof studentSchema>;

