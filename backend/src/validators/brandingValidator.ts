import { z } from 'zod';

export const brandingSchema = z.object({
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  themeFlags: z.record(z.string(), z.boolean()).optional(),
  typography: z
    .object({
      fontFamily: z.string().optional(),
      headingWeight: z.string().optional(),
      bodyWeight: z.string().optional(),
    })
    .optional(),
  navigation: z
    .object({
      style: z.enum(['top', 'side']).optional(),
      showLogo: z.boolean().optional(),
    })
    .optional(),
});

export type BrandingInput = z.infer<typeof brandingSchema>;
