import type { PoolClient } from 'pg';
import { registerUser, type UserRegistrationInput } from './userRegistrationService';
import { createAuditLog } from './audit/enhancedAuditService';
import { Role } from '../config/permissions';
import { getPool } from '../db/connection';

export interface AdminCreateUserInput {
  email: string;
  password: string;
  role: 'student' | 'teacher' | 'hod'; // 'hod' is handled specially - created as teacher with HOD role
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
  departmentId?: string; // For HOD
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
    // For HOD, we create as teacher first, then assign HOD role
    const actualRole: 'student' | 'teacher' | 'admin' =
      input.role === 'hod' ? 'teacher' : input.role;
    const registrationInput: UserRegistrationInput = {
      email: input.email,
      password: input.password,
      role: actualRole,
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
      // Teacher fields
      phone: input.phone,
      qualifications: input.qualifications,
      yearsOfExperience: input.yearsOfExperience,
      subjects: input.subjects,
      teacherId: input.teacherId,
    };

    // Use unified registration service with admin options
    const result = await registerUser(tenantId, tenantClient, schemaName, registrationInput, {
      immediateActivation: true, // Admin-created users are immediately active
      createProfileImmediately: true, // Create profile record immediately
      actorId, // For audit logging
    });

    if (!result.profileId) {
      throw new Error('Failed to create profile record');
    }

    // If creating HOD, assign HOD role and department
    if (input.role === 'hod') {
      const pool = getPool();

      // Assign HOD role
      await pool.query(
        `INSERT INTO shared.user_roles (user_id, role_name, assigned_by)
         VALUES ($1, 'hod', $2)
         ON CONFLICT (user_id, role_name) DO NOTHING`,
        [result.userId, actorId]
      );

      // Assign department if provided
      if (input.departmentId) {
        await pool.query(`UPDATE shared.users SET department_id = $1 WHERE id = $2`, [
          input.departmentId,
          result.userId,
        ]);
      }
    }

    // Create audit log for teacher/HOD creation
    if (input.role === 'teacher' || input.role === 'hod') {
      try {
        await createAuditLog(tenantClient, {
          tenantId: tenantId,
          userId: actorId,
          action: input.role === 'hod' ? 'HOD_CREATED' : 'TEACHER_CREATED',
          resourceType: input.role === 'hod' ? 'hod' : 'teacher',
          resourceId: result.userId,
          details: {
            email: result.email,
            profileId: result.profileId,
            assignedClasses: input.subjects || [],
            departmentId: input.departmentId || null,
          },
          severity: 'info',
        });
      } catch (auditError) {
        console.error(
          '[adminUserService] Failed to create audit log for teacher creation:',
          auditError
        );
      }
    }

    return {
      userId: result.userId,
      profileId: result.profileId,
      email: result.email,
      role: result.role,
      status: 'active',
    };
  } catch (error) {
    console.error('[adminUserService] Error creating user:', error);
    throw error;
  }
}
