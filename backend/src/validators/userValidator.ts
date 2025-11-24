import { z } from 'zod';

export const roleUpdateSchema = z.object({
  role: z.enum(['student', 'teacher', 'admin', 'superadmin']),
});

export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>;
