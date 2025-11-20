import type { PoolClient } from 'pg';
import { registerUser, type UserRegistrationInput } from './userRegistrationService';
import { Role } from '../config/permissions';

export interface AdminCreateUserInput {
  email: string;
  password: string;
  role: 'student' | 'teacher' | 'hod';
  // Common profile fields
  fullName: string;
  gender?: 'male' | 'female' | 'other';
  address?: string;
  // Student-specific fields
  dateOfBirth?: string;
  parentGuardianName?: string;
  parentGuardianContact?: string;
  studentId?: string;
  classId?: string;
  // Teacher/HOD-specific fields
  phone?: string;
  qualifications?: string;
  yearsOfExperience?: number;
  subjects?: string[];
  teacherId?: string;
  // HOD-specific fields
  departmentId?: string;
}

export interface AdminCreateUserResult {
  userId: string;
  profileId: string;
  email: string;
  role: Role;
  status: 'active';
}

/**
 * Admin creates a new user with profile data
 * Creates both the user account (in shared.users) and the profile record (student/teacher)
 * User is created as 'active' immediately (no approval needed)
 * 
 * This function uses the unified registration service with admin-specific options:
 * - immediateActivation: true (user is active immediately)
 * - createProfileImmediately: true (profile record created immediately)
 */
export async function adminCreateUser(
  tenantId: string,
  tenantClient: PoolClient,
  schemaName: string,
  input: AdminCreateUserInput,
  actorId: string
): Promise<AdminCreateUserResult> {
  try {
    // Convert admin input to unified registration input
    const registrationInput: UserRegistrationInput = {
      email: input.email,
      password: input.password,
      role: input.role,
      tenantId: tenantId,
      fullName: input.fullName,
      gender: input.gender,
      address: input.address,
      // Student fields
      dateOfBirth: input.dateOfBirth,
      parentGuardianName: input.parentGuardianName,
      parentGuardianContact: input.parentGuardianContact,
      studentId: input.studentId,
      classId: input.classId,
      // Teacher/HOD fields
      phone: input.phone,
      qualifications: input.qualifications,
      yearsOfExperience: input.yearsOfExperience,
      subjects: input.subjects,
      teacherId: input.teacherId,
      // HOD fields
      departmentId: input.departmentId
    };

    // Use unified registration service with admin options
    const result = await registerUser(
      tenantId,
      tenantClient,
      schemaName,
      registrationInput,
      {
        immediateActivation: true, // Admin-created users are immediately active
        createProfileImmediately: true, // Create profile record immediately
        actorId // For audit logging
      }
    );

    if (!result.profileId) {
      throw new Error('Failed to create profile record');
    }

    return {
      userId: result.userId,
      profileId: result.profileId,
      email: result.email,
      role: result.role,
      status: 'active'
    };
  } catch (error) {
    console.error('[adminUserService] Error creating user:', error);
    throw error;
  }
}

