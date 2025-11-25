import crypto from 'crypto';
import type { PoolClient } from 'pg';
import { getTableName, serializeJsonField } from '../lib/serviceUtils';
import {
  classSubjectAssignmentSchema,
  studentSubjectSchema,
  teacherAssignmentSchema
} from '../validators/subjectValidator';
import type { SubjectInput } from '../validators/subjectValidator';
import { z } from 'zod';

type ClassSubjectAssignmentInput = z.infer<typeof classSubjectAssignmentSchema>;
type TeacherAssignmentInput = z.infer<typeof teacherAssignmentSchema>;
type StudentSubjectInput = z.infer<typeof studentSubjectSchema>;

export async function listSubjects(client: PoolClient, schema: string) {
  const result = await client.query(
    `SELECT * FROM ${getTableName(schema, 'subjects')} ORDER BY name ASC`
  );
  return result.rows;
}

export async function createSubject(client: PoolClient, schema: string, payload: SubjectInput) {
  const result = await client.query(
    `
      INSERT INTO ${getTableName(schema, 'subjects')} (name, code, description, metadata)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [
      payload.name,
      payload.code?.toUpperCase() ?? null,
      payload.description ?? null,
      serializeJsonField(payload.metadata ?? {})
    ]
  );
  return result.rows[0];
}

export async function updateSubject(
  client: PoolClient,
  schema: string,
  id: string,
  payload: Partial<SubjectInput>
) {
  const existing = await client.query(
    `SELECT * FROM ${getTableName(schema, 'subjects')} WHERE id = $1`,
    [id]
  );
  if (existing.rowCount === 0) {
    return null;
  }

  const subject = existing.rows[0];
  const result = await client.query(
    `
      UPDATE ${getTableName(schema, 'subjects')}
      SET name = $1,
          code = $2,
          description = $3,
          metadata = $4,
          updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `,
    [
      payload.name ?? subject.name,
      (payload.code ?? subject.code)?.toUpperCase() ?? null,
      payload.description ?? subject.description,
      serializeJsonField(payload.metadata ?? subject.metadata ?? {}),
      id
    ]
  );
  return result.rows[0];
}

export async function deleteSubject(client: PoolClient, schema: string, id: string) {
  await client.query(`DELETE FROM ${getTableName(schema, 'subjects')} WHERE id = $1`, [id]);
}

export async function replaceClassSubjects(
  client: PoolClient,
  schema: string,
  classId: string,
  payload: ClassSubjectAssignmentInput
) {
  const table = getTableName(schema, 'class_subjects');
  await client.query('BEGIN');
  try {
    await client.query(`DELETE FROM ${table} WHERE class_id = $1`, [classId]);
    for (const subjectId of payload.subjectIds) {
      await client.query(
        `
          INSERT INTO ${table} (id, class_id, subject_id)
          VALUES ($1, $2, $3)
        `,
        [crypto.randomUUID(), classId, subjectId]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  const result = await client.query(
    `
      SELECT cs.class_id, cs.subject_id, s.name
      FROM ${table} cs
      JOIN ${getTableName(schema, 'subjects')} s ON s.id = cs.subject_id
      WHERE cs.class_id = $1
      ORDER BY s.name ASC
    `,
    [classId]
  );
  return result.rows;
}

export async function listClassSubjects(client: PoolClient, schema: string, classId: string) {
  const result = await client.query(
    `
      SELECT cs.class_id, cs.subject_id, s.name, s.code
      FROM ${getTableName(schema, 'class_subjects')} cs
      JOIN ${getTableName(schema, 'subjects')} s ON s.id = cs.subject_id
      WHERE cs.class_id = $1
      ORDER BY s.name ASC
    `,
    [classId]
  );
  return result.rows;
}

export async function upsertTeacherAssignment(
  client: PoolClient,
  schema: string,
  teacherId: string,
  payload: TeacherAssignmentInput
) {
  const result = await client.query(
    `
      INSERT INTO ${getTableName(schema, 'teacher_assignments')} (teacher_id, class_id, subject_id, is_class_teacher, metadata)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (teacher_id, class_id, subject_id)
      DO UPDATE SET
        is_class_teacher = EXCLUDED.is_class_teacher,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *
    `,
    [
      teacherId,
      payload.classId,
      payload.subjectId,
      payload.isClassTeacher ?? false,
      serializeJsonField(payload.metadata ?? {})
    ]
  );
  return result.rows[0];
}

export async function listTeacherAssignments(client: PoolClient, schema: string) {
  const result = await client.query(
    `
      SELECT ta.*, t.name as teacher_name, c.name as class_name, s.name as subject_name
      FROM ${getTableName(schema, 'teacher_assignments')} ta
      JOIN ${getTableName(schema, 'teachers')} t ON t.id = ta.teacher_id
      JOIN ${getTableName(schema, 'classes')} c ON c.id = ta.class_id
      JOIN ${getTableName(schema, 'subjects')} s ON s.id = ta.subject_id
      ORDER BY t.name ASC, c.name ASC
    `
  );
  return result.rows;
}

export async function removeTeacherAssignment(
  client: PoolClient,
  schema: string,
  assignmentId: string
) {
  await client.query(`DELETE FROM ${getTableName(schema, 'teacher_assignments')} WHERE id = $1`, [
    assignmentId
  ]);
}

export async function replaceStudentSubjects(
  client: PoolClient,
  schema: string,
  studentId: string,
  payload: StudentSubjectInput
) {
  const table = getTableName(schema, 'student_subjects');
  await client.query('BEGIN');
  try {
    await client.query(`DELETE FROM ${table} WHERE student_id = $1`, [studentId]);
    for (const subjectId of payload.subjectIds) {
      await client.query(
        `
          INSERT INTO ${table} (id, student_id, subject_id)
          VALUES ($1, $2, $3)
        `,
        [crypto.randomUUID(), studentId, subjectId]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  const result = await client.query(
    `
      SELECT ss.student_id, ss.subject_id, s.name
      FROM ${table} ss
      JOIN ${getTableName(schema, 'subjects')} s ON s.id = ss.subject_id
      WHERE ss.student_id = $1
      ORDER BY s.name ASC
    `,
    [studentId]
  );
  return result.rows;
}

export async function listStudentSubjects(client: PoolClient, schema: string, studentId: string) {
  const result = await client.query(
    `
      SELECT ss.student_id,
             ss.subject_id,
             ss.metadata,
             s.name,
             s.code
      FROM ${getTableName(schema, 'student_subjects')} ss
      JOIN ${getTableName(schema, 'subjects')} s ON s.id = ss.subject_id
      WHERE ss.student_id = $1
      ORDER BY s.name ASC
    `,
    [studentId]
  );

  return result.rows;
}

export async function recordPromotion(
  client: PoolClient,
  schema: string,
  studentId: string,
  fromClassId: string | null,
  toClassId: string,
  promotedBy: string | null,
  notes?: string
) {
  await client.query(
    `
      INSERT INTO ${getTableName(schema, 'student_promotions')} (student_id, from_class_id, to_class_id, promoted_by, notes)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [studentId, fromClassId, toClassId, promotedBy, notes ?? null]
  );
}
