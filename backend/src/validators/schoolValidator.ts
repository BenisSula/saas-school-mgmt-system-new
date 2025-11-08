import { z } from 'zod';

export const schoolSchema = z.object({
  name: z.string().min(1),
  address: z
    .object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      postalCode: z.string().optional()
    })
    .partial()
    .optional()
});

export type SchoolInput = z.infer<typeof schoolSchema>;

