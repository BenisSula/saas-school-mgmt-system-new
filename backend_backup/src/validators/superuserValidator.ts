import { z } from 'zod';

export const subscriptionTypeSchema = z.enum(['free', 'trial', 'paid']);
export const tenantStatusSchema = z.enum(['active', 'suspended', 'deleted']);

export const createSchoolSchema = z.object({
  name: z.string().min(1, 'School name is required'),
  address: z.string().min(1, 'School address is required'),
  contactPhone: z.string().min(1, 'Contact phone number is required'),
  contactEmail: z.string().email('Please enter a valid contact email address'),
  registrationCode: z.string().min(1, 'Registration code is required'),
  domain: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((value) => {
      if (value === null || value === '' || value === undefined) return undefined;
      return value;
    }),
  subscriptionType: subscriptionTypeSchema.optional(),
  billingEmail: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((value) => {
      if (value === null || value === '' || value === undefined) return undefined;
      return value;
    })
    .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: 'Please enter a valid billing email address'
    })
    .optional()
});

export const updateSchoolSchema = createSchoolSchema
  .partial()
  .extend({
    status: tenantStatusSchema.optional(),
    address: z.string().nullable().optional().transform((value) => {
      if (value === null || value === '' || value === undefined) return undefined;
      return value;
    }),
    contactPhone: z.string().nullable().optional().transform((value) => {
      if (value === null || value === '' || value === undefined) return undefined;
      return value;
    }),
    contactEmail: z.string().email('Please enter a valid contact email address').nullable().optional().transform((value) => {
      if (value === null || value === '' || value === undefined) return undefined;
      return value;
    }),
    registrationCode: z.string().nullable().optional().transform((value) => {
      if (value === null || value === '' || value === undefined) return undefined;
      return value;
    }),
    name: z.string().min(1, 'School name is required').nullable().optional().transform((value) => {
      if (value === null || value === '' || value === undefined) return undefined;
      return value;
    })
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided'
  });

export const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().min(3, 'Username is required'),
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().optional()
});

export const sendAdminNotificationSchema = z.object({
  tenantId: z
    .string()
    .uuid()
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  targetRoles: z
    .array(z.string().min(1))
    .nonempty('At least one target role is required')
    .optional(),
  metadata: z
    .record(z.string(), z.any())
    .optional()
    .transform((value) => value ?? undefined)
});
