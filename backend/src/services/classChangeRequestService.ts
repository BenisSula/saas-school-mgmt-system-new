/**
 * Class Change Request Service
 * Handles student class change requests (pending approval workflow)
 */

import type { PoolClient } from 'pg';
import { getTableName } from '../lib/serviceUtils';
import { resolveClassId } from '../lib/crudHelpers';

export interface ClassChangeRequest {
  id: string;
  student_id: string;
  current_class_id: string | null;
  current_class_uuid: string | null;
  requested_class_id: string;
  requested_class_uuid: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_by?: string;
  reviewed_by?: string;
  reviewed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateClassChangeRequestInput {
  targetClassId: string;
  reason?: string;
}

/**
 * Create a class change request for a student
 */
export async function createClassChangeRequest(
  client: PoolClient,
  schema: string,
  studentId: string,
  input: CreateClassChangeRequestInput,
  requestedBy?: string
): Promise<ClassChangeRequest> {
  // Get current student class
  const studentTable = getTableName(schema, 'students');
  const studentResult = await client.query<{
    class_id: string | null;
    class_uuid: string | null;
  }>(`SELECT class_id, class_uuid FROM ${studentTable} WHERE id = $1`, [studentId]);

  if (studentResult.rows.length === 0) {
    throw new Error('Student not found');
  }

  const currentClassId = studentResult.rows[0].class_id;
  const currentClassUuid = studentResult.rows[0].class_uuid;

  // Resolve target class
  const { classIdName: requestedClassId, classUuid: requestedClassUuid } = await resolveClassId(
    client,
    schema,
    input.targetClassId
  );

  // Check if already in the requested class
  if (currentClassUuid === requestedClassUuid) {
    throw new Error('Student is already in the requested class');
  }

  // Check for existing pending request (table may not exist if migration hasn't run)
  const requestsTable = getTableName(schema, 'class_change_requests');

  try {
    const existingRequest = await client.query<{ id: string }>(
      `SELECT id FROM ${requestsTable} 
       WHERE student_id = $1 AND status = 'pending'`,
      [studentId]
    );

    if (existingRequest.rows.length > 0) {
      throw new Error('A pending class change request already exists for this student');
    }
  } catch (error) {
    // If table doesn't exist, that's okay - migration may not have run yet
    // But if it's a different error (like duplicate pending request), rethrow it
    if (error instanceof Error) {
      if (error.message.includes('pending class change request already exists')) {
        throw error;
      }
      // Check if it's a "relation does not exist" error
      const errorMessage = error.message.toLowerCase();
      if (
        !errorMessage.includes('does not exist') &&
        !errorMessage.includes('relation') &&
        !errorMessage.includes('table')
      ) {
        // Some other error occurred, rethrow it
        throw error;
      }
      // Table doesn't exist - that's fine, we'll create it via migration
    }
  }

  // Create the request (will fail if table doesn't exist - migration must be run first)
  try {
    const result = await client.query<ClassChangeRequest>(
      `
        INSERT INTO ${requestsTable} (
          student_id,
          current_class_id,
          current_class_uuid,
          requested_class_id,
          requested_class_uuid,
          reason,
          status,
          requested_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
        RETURNING *
      `,
      [
        studentId,
        currentClassId,
        currentClassUuid,
        requestedClassId,
        requestedClassUuid,
        input.reason || null,
        requestedBy || null,
      ]
    );

    return result.rows[0];
  } catch (error) {
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      if (
        errorMessage.includes('does not exist') ||
        errorMessage.includes('relation') ||
        errorMessage.includes('table')
      ) {
        throw new Error(
          'Class change requests table does not exist. Please run database migrations.'
        );
      }
    }
    throw error;
  }
}

/**
 * Get class change requests for a student
 */
export async function getStudentClassChangeRequests(
  client: PoolClient,
  schema: string,
  studentId: string
): Promise<ClassChangeRequest[]> {
  const requestsTable = getTableName(schema, 'class_change_requests');

  try {
    const result = await client.query<ClassChangeRequest>(
      `SELECT * FROM ${requestsTable} 
       WHERE student_id = $1 
       ORDER BY created_at DESC`,
      [studentId]
    );
    return result.rows;
  } catch (error) {
    // If table doesn't exist, return empty array (migration may not have run)
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      if (
        errorMessage.includes('does not exist') ||
        errorMessage.includes('relation') ||
        errorMessage.includes('table')
      ) {
        return [];
      }
    }
    throw error;
  }
}
