/**
 * Teacher Attendance Service
 * Handles teacher-specific attendance operations
 */

import type { PoolClient } from 'pg';
import { assertValidSchemaName } from '../db/tenantManager';
import { markAttendance, getClassReport, type AttendanceMark } from './attendanceService';
import { createAuditLog } from './audit/enhancedAuditService';
import { checkTeacherAssignment } from '../middleware/verifyTeacherAssignment';

export interface TeacherAttendanceQuery {
  classId?: string;
  date?: string;
  from?: string;
  to?: string;
}

/**
 * Mark attendance for a class (teacher-scoped)
 */
export async function markTeacherAttendance(
  client: PoolClient,
  schema: string,
  teacherId: string,
  records: AttendanceMark[],
  actorId: string
): Promise<void> {
  assertValidSchemaName(schema);

  // Verify teacher is assigned to the class
  if (records.length > 0 && records[0].classId) {
    const isAssigned = await checkTeacherAssignment(
      client,
      schema,
      teacherId,
      records[0].classId
    );
    if (!isAssigned) {
      throw new Error('Teacher is not assigned to this class');
    }
  }

  // Mark attendance using existing service
  await markAttendance(client, schema, records, actorId);

  // Create audit log
  try {
    await createAuditLog(client, {
      tenantId: undefined,
      userId: actorId,
      action: 'TEACHER_MARKED_ATTENDANCE',
      resourceType: 'attendance',
      resourceId: undefined,
      details: {
        teacherId,
        classId: records[0]?.classId,
        date: records[0]?.date,
        studentCount: records.length
      },
      severity: 'info'
    });
  } catch (auditError) {
    console.error('[teacherAttendanceService] Failed to create audit log:', auditError);
  }
}

/**
 * Get attendance for a class (teacher-scoped)
 */
export async function getTeacherAttendance(
  client: PoolClient,
  schema: string,
  teacherId: string,
  query: TeacherAttendanceQuery
) {
  assertValidSchemaName(schema);

  // Verify teacher is assigned to the class if classId is provided
  if (query.classId) {
    const isAssigned = await checkTeacherAssignment(client, schema, teacherId, query.classId);
    if (!isAssigned) {
      throw new Error('Teacher is not assigned to this class');
    }
  }

  if (query.classId && query.date) {
    // Get class report for specific date
    return await getClassReport(client, schema, query.classId, query.date);
  }

  // Get attendance records
  const params: unknown[] = [];
  const conditions: string[] = [];
  let paramIndex = 1;

  if (query.classId) {
    conditions.push(`class_id = $${paramIndex}`);
    params.push(query.classId);
    paramIndex++;
  }

  if (query.date) {
    conditions.push(`attendance_date = $${paramIndex}`);
    params.push(query.date);
    paramIndex++;
  } else {
    if (query.from) {
      conditions.push(`attendance_date >= $${paramIndex}`);
      params.push(query.from);
      paramIndex++;
    }
    if (query.to) {
      conditions.push(`attendance_date <= $${paramIndex}`);
      params.push(query.to);
      paramIndex++;
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await client.query(
    `
      SELECT 
        ar.*,
        s.first_name,
        s.last_name,
        s.admission_number
      FROM ${schema}.attendance_records ar
      JOIN ${schema}.students s ON ar.student_id = s.id
      ${whereClause}
      ORDER BY ar.attendance_date DESC, s.last_name, s.first_name
    `,
    params
  );

  return result.rows;
}

/**
 * Bulk mark attendance (teacher-scoped)
 */
export async function bulkMarkTeacherAttendance(
  client: PoolClient,
  schema: string,
  teacherId: string,
  records: AttendanceMark[],
  actorId: string
): Promise<void> {
  // Group records by classId to verify assignments
  const classIds = [...new Set(records.map((r) => r.classId).filter(Boolean))];

  for (const classId of classIds) {
    if (classId) {
      const isAssigned = await checkTeacherAssignment(client, schema, teacherId, classId);
      if (!isAssigned) {
        throw new Error(`Teacher is not assigned to class ${classId}`);
      }
    }
  }

  // Mark attendance
  await markAttendance(client, schema, records, actorId);

  // Create audit log
  try {
    await createAuditLog(client, {
      tenantId: undefined,
      userId: actorId,
      action: 'TEACHER_MARKED_ATTENDANCE',
      resourceType: 'attendance',
      resourceId: undefined,
      details: {
        teacherId,
        classIds: classIds,
        recordCount: records.length,
        dateRange: {
          from: records[0]?.date,
          to: records[records.length - 1]?.date
        }
      },
      severity: 'info'
    });
  } catch (auditError) {
    console.error('[teacherAttendanceService] Failed to create audit log:', auditError);
  }
}

