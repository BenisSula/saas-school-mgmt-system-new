import { PoolClient } from 'pg';
import { getPool } from '../db/connection';
import { createUser } from './userService';
import { createStudent } from './studentService';
import { createTeacher } from './teacherService';
import { transformToStudentInput, transformToTeacherInput } from '../lib/profileTransformUtils';
import { Role } from '../config/permissions';

/**
 * Unified registration input - supports both admin and self-registration
 */
export interface UserRegistrationInput {
  email: string;
  password: string;
  role: 'student' | 'teacher' | 'hod' | 'admin';
  tenantId?: string;
  tenantName?: string; // For admin creating new tenant
  // Common profile fields
  fullName?: string;
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

export interface UserRegistrationOptions {
  /**
   * If true, user is created as 'active' and verified (admin registration)
   * If false, user is created as 'pending' and unverified (self-registration)
   */
  immediateActivation?: boolean;
  /**
   * If true, profile record is created immediately (admin registration)
   * If false, profile data is stored in pending_profile_data (self-registration)
   */
  createProfileImmediately?: boolean;
  /**
   * Actor ID for audit logging (admin who created the user)
   */
  actorId?: string;
}

export interface UserRegistrationResult {
  userId: string;
  profileId?: string; // Only present if createProfileImmediately is true
  email: string;
  role: Role;
  status: 'pending' | 'active';
  isVerified: boolean;
}

/**
 * Unified user registration service
 * Handles both admin registration and user self-registration
 */
export async function registerUser(
  tenantId: string | null,
  tenantClient: PoolClient | null,
  schemaName: string | null,
  input: UserRegistrationInput,
  options: UserRegistrationOptions = {}
): Promise<UserRegistrationResult> {
  const { immediateActivation = false, createProfileImmediately = false, actorId } = options;

  const pool = getPool();

  // Determine user status and verification
  const userStatus: 'pending' | 'active' = immediateActivation ? 'active' : 'pending';
  const isVerified = immediateActivation || input.role === 'admin';

  // Step 1: Create user account in shared.users
  const createdUser = await createUser(pool, {
    email: input.email,
    password: input.password,
    role: input.role,
    tenantId: tenantId,
    status: userStatus,
    isVerified: isVerified,
    departmentId: input.departmentId || null, // Set departmentId for HOD
    // Store profile data if not creating immediately (self-registration)
    pendingProfileData:
      !createProfileImmediately && input.role !== 'admin'
        ? {
            fullName: input.fullName,
            gender: input.gender,
            address: input.address,
            dateOfBirth: input.dateOfBirth,
            parentGuardianName: input.parentGuardianName,
            parentGuardianContact: input.parentGuardianContact,
            studentId: input.studentId,
            classId: input.classId,
            phone: input.phone,
            qualifications: input.qualifications,
            yearsOfExperience: input.yearsOfExperience,
            subjects: input.subjects,
            teacherId: input.teacherId,
            departmentId: input.departmentId,
            role: input.role
          }
        : null
  });

  let profileId: string | undefined;

  // Step 2: Create profile record immediately if requested (admin registration)
  if (createProfileImmediately && tenantClient && schemaName && input.role !== 'admin') {
    if (input.role === 'student' && input.fullName) {
      const studentData = transformToStudentInput(input);
      const student = await createStudent(tenantClient, schemaName, studentData);
      profileId = student.id;
    } else if ((input.role === 'teacher' || input.role === 'hod') && input.fullName) {
      // HODs are created as teachers with department assignment
      const teacherData = transformToTeacherInput(input, input.email);
      const teacher = await createTeacher(tenantClient, schemaName, teacherData);
      profileId = teacher.id;
      // Note: departmentId is already set in shared.users.department_id
      // HOD profile is the same as teacher profile
    }

    if (actorId) {
      console.info('[audit] admin_user_created', {
        tenantId,
        userId: createdUser.id,
        profileId,
        role: input.role,
        actorId
      });
    }
  }

  return {
    userId: createdUser.id,
    profileId,
    email: createdUser.email,
    role: createdUser.role,
    status: userStatus,
    isVerified: isVerified
  };
}
