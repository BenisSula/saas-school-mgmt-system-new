/**
 * Teacher Grades Service
 * Handles teacher-specific grade operations
 */

import type { PoolClient } from 'pg';
import { assertValidSchemaName } from '../db/tenantManager';
import { checkTeacherAssignment } from '../middleware/verifyTeacherAssignment';
import { createAuditLog } from './audit/enhancedAuditService';

export interface GradeSubmission {
  studentId: string;
  classId: string;
  subjectId?: string;
  examId?: string;
  score: number;
  remarks?: string;
  term?: string;
}

export interface GradeQuery {
  classId?: string;
  subjectId?: string;
  term?: string;
  examId?: string;
}

/**
 * Submit grades for students (teacher-scoped)
 */
export async function submitTeacherGrades(
  client: PoolClient,
  schema: string,
  teacherId: string,
  grades: GradeSubmission[],
  actorId: string
): Promise<Array<{ id: string; studentId: string; score: number }>> {
  assertValidSchemaName(schema);

  // Verify teacher is assigned to the class
  if (grades.length > 0 && grades[0].classId) {
    const isAssigned = await checkTeacherAssignment(
      client,
      schema,
      teacherId,
      grades[0].classId,
      grades[0].subjectId
    );
    if (!isAssigned) {
      throw new Error('Teacher is not assigned to this class/subject');
    }
  }

  const results: Array<{ id: string; studentId: string; score: number }> = [];

  for (const grade of grades) {
    // Check if grade already exists
    let gradeId: string;
    const existingCheck = await client.query<{ id: string }>(
      `
        SELECT id FROM ${schema}.grades
        WHERE student_id = $1
          AND class_id = $2
          ${grade.examId ? 'AND exam_id = $3' : 'AND exam_id IS NULL'}
          ${grade.subjectId ? 'AND subject_id = $4' : 'AND subject_id IS NULL'}
        LIMIT 1
      `,
      [
        grade.studentId,
        grade.classId,
        ...(grade.examId ? [grade.examId] : []),
        ...(grade.subjectId ? [grade.subjectId] : []),
      ].filter(Boolean)
    );

    if (existingCheck.rows.length > 0) {
      // Update existing grade
      gradeId = existingCheck.rows[0].id;
      await client.query(
        `
          UPDATE ${schema}.grades
          SET score = $1,
              remarks = $2,
              updated_at = NOW()
          WHERE id = $3
        `,
        [grade.score, grade.remarks || null, gradeId]
      );
    } else {
      // Insert new grade
      const insertResult = await client.query<{ id: string }>(
        `
          INSERT INTO ${schema}.grades (
            student_id, class_id, subject_id, exam_id, score, remarks, term, created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `,
        [
          grade.studentId,
          grade.classId,
          grade.subjectId || null,
          grade.examId || null,
          grade.score,
          grade.remarks || null,
          grade.term || null,
          actorId,
        ]
      );
      gradeId = insertResult.rows[0].id;
    }

    results.push({
      id: gradeId,
      studentId: grade.studentId,
      score: grade.score,
    });
  }

  // Create audit log
  try {
    await createAuditLog(client, {
      tenantId: undefined,
      userId: actorId,
      action: 'TEACHER_SUBMITTED_GRADES',
      resourceType: 'grade',
      resourceId: undefined,
      details: {
        teacherId,
        classId: grades[0]?.classId,
        subjectId: grades[0]?.subjectId,
        gradeCount: grades.length,
      },
      severity: 'info',
    });
  } catch (auditError) {
    console.error('[teacherGradesService] Failed to create audit log:', auditError);
  }

  return results;
}

/**
 * Get grades for a class/subject (teacher-scoped)
 */
export async function getTeacherGrades(
  client: PoolClient,
  schema: string,
  teacherId: string,
  query: GradeQuery
) {
  assertValidSchemaName(schema);

  // Verify teacher is assigned to the class/subject
  if (query.classId) {
    const isAssigned = await checkTeacherAssignment(
      client,
      schema,
      teacherId,
      query.classId,
      query.subjectId
    );
    if (!isAssigned) {
      throw new Error('Teacher is not assigned to this class/subject');
    }
  }

  const params: unknown[] = [];
  const conditions: string[] = [];
  let paramIndex = 1;

  if (query.classId) {
    conditions.push(`g.class_id = $${paramIndex}`);
    params.push(query.classId);
    paramIndex++;
  }

  if (query.subjectId) {
    conditions.push(`g.subject_id = $${paramIndex}`);
    params.push(query.subjectId);
    paramIndex++;
  }

  if (query.examId) {
    conditions.push(`g.exam_id = $${paramIndex}`);
    params.push(query.examId);
    paramIndex++;
  }

  if (query.term) {
    conditions.push(`g.term = $${paramIndex}`);
    params.push(query.term);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await client.query(
    `
      SELECT 
        g.*,
        s.first_name,
        s.last_name,
        s.admission_number
      FROM ${schema}.grades g
      JOIN ${schema}.students s ON g.student_id = s.id
      ${whereClause}
      ORDER BY s.last_name, s.first_name
    `,
    params
  );

  return result.rows;
}

/**
 * Update a specific grade (teacher-scoped)
 */
export async function updateTeacherGrade(
  client: PoolClient,
  schema: string,
  teacherId: string,
  gradeId: string,
  updates: { score?: number; remarks?: string },
  actorId: string
): Promise<{ id: string; studentId: string; score: number } | null> {
  assertValidSchemaName(schema);

  // Get the grade to verify teacher assignment
  const gradeCheck = await client.query<{ class_id: string; subject_id: string | null }>(
    `SELECT class_id, subject_id FROM ${schema}.grades WHERE id = $1`,
    [gradeId]
  );

  if (gradeCheck.rows.length === 0) {
    return null;
  }

  const grade = gradeCheck.rows[0];

  // Verify teacher is assigned
  const isAssigned = await checkTeacherAssignment(
    client,
    schema,
    teacherId,
    grade.class_id,
    grade.subject_id || undefined
  );
  if (!isAssigned) {
    throw new Error('Teacher is not assigned to this class/subject');
  }

  // Update the grade
  const updateParams: unknown[] = [];
  const updateFields: string[] = [];
  let paramIndex = 1;

  if (updates.score !== undefined) {
    updateFields.push(`score = $${paramIndex}`);
    updateParams.push(updates.score);
    paramIndex++;
  }

  if (updates.remarks !== undefined) {
    updateFields.push(`remarks = $${paramIndex}`);
    updateParams.push(updates.remarks);
    paramIndex++;
  }

  updateFields.push(`updated_at = NOW()`);
  updateParams.push(gradeId);

  await client.query(
    `
      UPDATE ${schema}.grades
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, student_id, score
    `,
    updateParams
  );

  const result = await client.query<{ id: string; student_id: string; score: number }>(
    `SELECT id, student_id, score FROM ${schema}.grades WHERE id = $1`,
    [gradeId]
  );

  // Create audit log
  try {
    await createAuditLog(client, {
      tenantId: undefined,
      userId: actorId,
      action: 'TEACHER_UPDATED_GRADE',
      resourceType: 'grade',
      resourceId: gradeId,
      details: {
        teacherId,
        classId: grade.class_id,
        updates,
      },
      severity: 'info',
    });
  } catch (auditError) {
    console.error('[teacherGradesService] Failed to create audit log:', auditError);
  }

  if (result.rows.length === 0) {
    return null;
  }

  return {
    id: result.rows[0].id,
    studentId: result.rows[0].student_id,
    score: result.rows[0].score,
  };
}
