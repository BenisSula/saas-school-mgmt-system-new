/**
 * User Registration Validators
 * Canonical validation schemas for user registration
 * 
 * CONSOLIDATED: This file consolidates user registration schemas from:
 * - backend/src/routes/users.ts:24-43 (adminCreateUserSchema)
 * - backend/src/routes/admin/userManagement.ts:24-56 (createHODSchema, createTeacherSchema, createStudentSchema)
 * 
 * STATUS: ✅ COMPLETE - Canonical file ready
 */

import { z } from 'zod';

/**
 * Admin user creation schema
 * Used for creating students and teachers by admin
 * 
 * Source: backend/src/routes/users.ts:24-43
 */
export const adminCreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['student', 'teacher']),
  fullName: z.string().min(2),
  gender: z.enum(['male', 'female', 'other']).optional(),
  address: z.string().optional(),
  // Student fields
  dateOfBirth: z.string().optional(),
  parentGuardianName: z.string().optional(),
  parentGuardianContact: z.string().optional(),
  studentId: z.string().optional(),
  classId: z.string().optional(),
  // Teacher fields
  phone: z.string().optional(),
  qualifications: z.string().optional(),
  yearsOfExperience: z.number().optional(),
  subjects: z.array(z.string()).optional(),
  teacherId: z.string().optional()
});

/**
 * HOD creation schema
 * 
 * Source: backend/src/routes/admin/userManagement.ts:24-33
 */
export const createHODSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().optional().nullable(),
  departmentId: z.string().uuid('Invalid department ID').optional().nullable(),
  qualifications: z.string().optional(),
  yearsOfExperience: z.number().int().positive().optional(),
  subjects: z.array(z.string()).optional()
});

/**
 * Teacher creation schema
 * 
 * Source: backend/src/routes/admin/userManagement.ts:35-44
 */
export const createTeacherSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().optional().nullable(),
  qualifications: z.string().optional(),
  yearsOfExperience: z.number().int().positive().optional(),
  subjects: z.array(z.string()).optional(),
  teacherId: z.string().optional()
});

/**
 * Student creation schema
 * 
 * Source: backend/src/routes/admin/userManagement.ts:46-56
 */
export const createStudentSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1, 'Full name is required'),
  gender: z.enum(['male', 'female', 'other']).optional(),
  dateOfBirth: z.string().optional(),
  parentGuardianName: z.string().optional(),
  parentGuardianContact: z.string().optional(),
  studentId: z.string().optional(),
  classId: z.string().uuid('Invalid class ID').optional().nullable()
});

