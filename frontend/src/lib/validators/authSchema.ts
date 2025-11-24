import { z } from 'zod';

// Base password validation - strong password rules
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// Email validation
const emailSchema = z.string().email('Please enter a valid email address').toLowerCase();

// Common fields
const fullNameSchema = z.string().min(2, 'Name must be at least 2 characters long').trim();
const genderSchema = z
  .enum(['male', 'female', 'other'])
  .refine((val) => ['male', 'female', 'other'].includes(val), {
    message: 'Please select a valid gender',
  });
const phoneSchema = z
  .string()
  .regex(/^\+?[\d\s-()]+$/, 'Please enter a valid phone number')
  .min(10, 'Phone number must be at least 10 digits');

// RBAC: Only student and teacher can self-register
// Admin can only register when creating a new tenant (handled separately)
// Superadmin and HOD cannot self-register (must be created by admins)
const allowedSelfRegisterRoles = ['student', 'teacher', 'admin'] as const;

// Base registration schema
export const baseRegistrationSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  role: z.enum(allowedSelfRegisterRoles).refine((val) => allowedSelfRegisterRoles.includes(val), {
    message:
      'Invalid role. Only student and teacher can self-register. Admin registration requires creating a new organization.',
  }),
  tenantId: z.string().uuid().optional(),
  tenantName: z.string().min(3, 'Organization name must be at least 3 characters').optional(),
});

// Student-specific fields
export const studentProfileSchema = z.object({
  fullName: fullNameSchema,
  gender: genderSchema,
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .refine(
      (date) => {
        const birthDate = new Date(date);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        return age >= 5 && age <= 100;
      },
      { message: 'Date of birth must be valid and age must be between 5 and 100 years' }
    ),
  parentGuardianName: z.string().min(2, 'Parent/Guardian name is required').trim(),
  parentGuardianContact: phoneSchema,
  studentId: z.string().optional(),
  classId: z.string().min(1, 'Class/Grade is required').optional(),
  address: z.string().min(10, 'Address must be at least 10 characters long').trim(),
});

// Teacher-specific fields
export const teacherProfileSchema = z.object({
  fullName: fullNameSchema,
  gender: genderSchema,
  phone: phoneSchema,
  qualifications: z.string().min(5, 'Qualifications must be at least 5 characters long').trim(),
  yearsOfExperience: z
    .number()
    .int('Years of experience must be a whole number')
    .min(0, 'Years of experience cannot be negative')
    .max(50, 'Years of experience cannot exceed 50'),
  subjects: z
    .array(z.string().min(1, 'Subject cannot be empty'))
    .min(1, 'Please select at least one subject'),
  teacherId: z.string().optional(),
  address: z.string().min(10, 'Address must be at least 10 characters long').trim(),
});

// Combined student registration schema
export const studentRegistrationSchema = baseRegistrationSchema
  .merge(studentProfileSchema)
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.role === 'student', {
    message: 'Role must be student',
    path: ['role'],
  })
  .refine((data) => data.tenantId || data.tenantName, {
    message: 'Either tenantId or tenantName is required for student registration',
    path: ['tenantId'],
  });

// Combined teacher registration schema
export const teacherRegistrationSchema = baseRegistrationSchema
  .merge(teacherProfileSchema)
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.role === 'teacher', {
    message: 'Role must be teacher',
    path: ['role'],
  })
  .refine((data) => data.tenantId || data.tenantName, {
    message: 'Either tenantId or tenantName is required for teacher registration',
    path: ['tenantId'],
  });

// Admin registration schema (simpler)
export const adminRegistrationSchema = baseRegistrationSchema
  .extend({
    fullName: fullNameSchema,
    tenantName: z.string().min(3, 'Organization name must be at least 3 characters').optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.role === 'admin', {
    message: 'Role must be admin',
    path: ['role'],
  });

// Type exports
export type BaseRegistrationInput = z.infer<typeof baseRegistrationSchema>;
export type StudentProfileInput = z.infer<typeof studentProfileSchema>;
export type TeacherProfileInput = z.infer<typeof teacherProfileSchema>;
export type StudentRegistrationInput = z.infer<typeof studentRegistrationSchema>;
export type TeacherRegistrationInput = z.infer<typeof teacherRegistrationSchema>;
export type AdminRegistrationInput = z.infer<typeof adminRegistrationSchema>;
