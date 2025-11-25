import { z } from 'zod';

export const createClassResourceSchema = z.object({
  class_id: z.string().uuid('Invalid class ID'),
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  resource_type: z.enum(['document', 'link', 'file', 'video']),
  resource_url: z.string().url('Invalid resource URL'),
  file_name: z.string().max(255).optional(),
  file_size: z.number().int().positive().optional(),
  mime_type: z.string().max(100).optional(),
});

export const updateClassResourceSchema = createClassResourceSchema.partial();

export type CreateClassResourceInput = z.infer<typeof createClassResourceSchema>;
export type UpdateClassResourceInput = z.infer<typeof updateClassResourceSchema>;
