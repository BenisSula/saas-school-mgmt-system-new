import { z } from 'zod';

export const brandingSchema = z.object({
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  themeFlags: z.record(z.string(), z.boolean()).optional()
});

export type BrandingInput = z.infer<typeof brandingSchema>;

