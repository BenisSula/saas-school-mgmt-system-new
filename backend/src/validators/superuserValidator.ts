import { z } from 'zod';

export const subscriptionTypeSchema = z.enum(['free', 'trial', 'paid']);
export const tenantStatusSchema = z.enum(['active', 'suspended', 'deleted']);

export const createSchoolSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  domain: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
  subscriptionType: subscriptionTypeSchema.optional(),
  billingEmail: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === '' ? undefined : value))
    .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: 'Invalid email'
    })
    .optional()
});

export const updateSchoolSchema = createSchoolSchema
  .partial()
  .extend({
    status: tenantStatusSchema.optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided'
  });

export const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === '' ? undefined : value))
});

export const sendAdminNotificationSchema = z.object({
  tenantId: z
    .string()
    .uuid()
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Body is required'),
  metadata: z
    .record(z.string(), z.any())
    .optional()
    .transform((value) => value ?? undefined)
});
