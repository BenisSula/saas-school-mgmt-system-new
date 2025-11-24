import { PoolClient } from 'pg';
import { getPool } from '../db/connection';
import { createStudent } from './studentService';
import { createTeacher } from './teacherService';
import {
  transformToStudentInput,
  transformToTeacherInput,
  type RegistrationProfileData,
} from '../lib/profileTransformUtils';

/**
 * Process pending profile data when a user is approved
 * Creates student or teacher records in the tenant schema
 *
 * @param tenantClient - Already connected tenant database client (with search_path set)
 * @param schemaName - Tenant schema name
 * @param userId - User ID from shared.users
 * @param userEmail - User email
 * @param userRole - User role
 */
export async function processPendingProfile(
  tenantClient: PoolClient,
  schemaName: string,
  userId: string,
  userEmail: string,
  userRole: string
): Promise<{ success: boolean; recordId?: string; error?: string }> {
  const pool = getPool();
  const mainClient = await pool.connect();

  try {
    // Get user's pending profile data from shared.users
    const userResult = await mainClient.query(
      `
        SELECT pending_profile_data
        FROM shared.users
        WHERE id = $1
      `,
      [userId]
    );

    if (userResult.rowCount === 0) {
      return { success: false, error: 'User not found' };
    }

    const user = userResult.rows[0];
    const pendingProfileData = user.pending_profile_data as RegistrationProfileData | null;

    // If no profile data, nothing to process
    if (!pendingProfileData) {
      return { success: true };
    }

    let recordId: string | undefined;

    if (userRole === 'student' && pendingProfileData) {
      // Process student profile using shared transformation utility
      const studentData = transformToStudentInput(pendingProfileData);
      const student = await createStudent(tenantClient, schemaName, studentData);
      recordId = student.id;
    } else if (userRole === 'teacher' && pendingProfileData) {
      // Process teacher profile using shared transformation utility
      const teacherData = transformToTeacherInput(pendingProfileData, userEmail);
      const teacher = await createTeacher(tenantClient, schemaName, teacherData);
      recordId = teacher.id;
    }

    // Clear pending profile data after successful creation (for both student and teacher)
    if (recordId) {
      await mainClient.query(`UPDATE shared.users SET pending_profile_data = NULL WHERE id = $1`, [
        userId,
      ]);
    }

    return { success: true, recordId };
  } catch (error) {
    console.error('[profileService] Error processing pending profile:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process profile',
    };
  } finally {
    mainClient.release();
  }
}

/**
 * Clean up pending profile data when a user is rejected
 * Removes the pending_profile_data from the user record
 */
export async function cleanupPendingProfile(
  tenantId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `
        UPDATE shared.users
        SET pending_profile_data = NULL
        WHERE id = $1 AND tenant_id = $2
        RETURNING id
      `,
      [userId, tenantId]
    );

    if (result.rowCount === 0) {
      return { success: false, error: 'User not found for tenant' };
    }

    return { success: true };
  } catch (error) {
    console.error('[profileService] Error cleaning up pending profile:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cleanup profile',
    };
  } finally {
    client.release();
  }
}
