"use strict";
/**
 * Shared Authentication Validators
 *
 * Validation schemas for authentication shared between frontend and backend.
 * Uses Zod for runtime validation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSchema = exports.adminRegistrationSchema = exports.teacherRegistrationSchema = exports.studentRegistrationSchema = exports.teacherProfileSchema = exports.studentProfileSchema = exports.baseRegistrationSchema = exports.allowedSelfRegisterRoles = exports.phoneSchema = exports.genderSchema = exports.fullNameSchema = exports.emailSchema = exports.passwordSchema = void 0;
const zod_1 = require("zod");
// Base password validation - strong password rules
exports.passwordSchema = zod_1.z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');
// Email validation
exports.emailSchema = zod_1.z.string().email('Please enter a valid email address').toLowerCase();
// Common fields
exports.fullNameSchema = zod_1.z.string().min(2, 'Name must be at least 2 characters long').trim();
exports.genderSchema = zod_1.z
    .enum(['male', 'female', 'other'])
    .refine((val) => ['male', 'female', 'other'].includes(val), {
    message: 'Please select a valid gender'
});
exports.phoneSchema = zod_1.z
    .string()
    .regex(/^\+?[\d\s-()]+$/, 'Please enter a valid phone number')
    .min(10, 'Phone number must be at least 10 digits');
// RBAC: Only student and teacher can self-register
// Admin can only register when creating a new tenant (handled separately)
// Superadmin and HOD cannot self-register (must be created by admins)
exports.allowedSelfRegisterRoles = ['student', 'teacher', 'admin'];
// Base registration schema
exports.baseRegistrationSchema = zod_1.z.object({
    email: exports.emailSchema,
    password: exports.passwordSchema,
    confirmPassword: zod_1.z.string(),
    role: zod_1.z.enum(exports.allowedSelfRegisterRoles).refine((val) => exports.allowedSelfRegisterRoles.includes(val), {
        message: 'Invalid role. Only student and teacher can self-register. Admin registration requires creating a new organization.'
    }),
    tenantId: zod_1.z.string().uuid().optional(),
    tenantName: zod_1.z.string().min(3, 'Organization name must be at least 3 characters').optional()
});
// Student-specific fields
exports.studentProfileSchema = zod_1.z.object({
    fullName: exports.fullNameSchema,
    gender: exports.genderSchema,
    dateOfBirth: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
        .refine((date) => {
        const birthDate = new Date(date);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        return age >= 5 && age <= 100;
    }, { message: 'Date of birth must be valid and age must be between 5 and 100 years' }),
    parentGuardianName: zod_1.z.string().min(2, 'Parent/Guardian name is required').trim(),
    parentGuardianContact: exports.phoneSchema,
    studentId: zod_1.z.string().optional(),
    classId: zod_1.z.string().min(1, 'Class/Grade is required').optional(),
    address: zod_1.z.string().min(10, 'Address must be at least 10 characters long').trim()
});
// Teacher-specific fields
exports.teacherProfileSchema = zod_1.z.object({
    fullName: exports.fullNameSchema,
    gender: exports.genderSchema,
    phone: exports.phoneSchema,
    qualifications: zod_1.z.string().min(5, 'Qualifications must be at least 5 characters long').trim(),
    yearsOfExperience: zod_1.z
        .number()
        .int('Years of experience must be a whole number')
        .min(0, 'Years of experience cannot be negative')
        .max(50, 'Years of experience cannot exceed 50'),
    subjects: zod_1.z
        .array(zod_1.z.string().min(1, 'Subject cannot be empty'))
        .min(1, 'Please select at least one subject'),
    teacherId: zod_1.z.string().optional(),
    address: zod_1.z.string().min(10, 'Address must be at least 10 characters long').trim()
});
// Combined student registration schema
exports.studentRegistrationSchema = exports.baseRegistrationSchema
    .merge(exports.studentProfileSchema)
    .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
})
    .refine((data) => data.role === 'student', {
    message: 'Role must be student',
    path: ['role']
})
    .refine((data) => data.tenantId || data.tenantName, {
    message: 'Either tenantId or tenantName is required for student registration',
    path: ['tenantId']
});
// Combined teacher registration schema
exports.teacherRegistrationSchema = exports.baseRegistrationSchema
    .merge(exports.teacherProfileSchema)
    .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
})
    .refine((data) => data.role === 'teacher', {
    message: 'Role must be teacher',
    path: ['role']
})
    .refine((data) => data.tenantId || data.tenantName, {
    message: 'Either tenantId or tenantName is required for teacher registration',
    path: ['tenantId']
});
// Admin registration schema (simpler)
exports.adminRegistrationSchema = exports.baseRegistrationSchema
    .extend({
    fullName: exports.fullNameSchema,
    tenantName: zod_1.z.string().min(3, 'Organization name must be at least 3 characters').optional()
})
    .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
})
    .refine((data) => data.role === 'admin', {
    message: 'Role must be admin',
    path: ['role']
});
// Login schema
exports.loginSchema = zod_1.z.object({
    email: exports.emailSchema,
    password: zod_1.z.string().min(1, 'Password is required'),
    tenantId: zod_1.z.string().uuid().optional()
});
