/**
 * Admin Class Management Service
 * Handles class CRUD operations within tenant schema
 * 
 * DRY: Reuses existing audit logging utilities
 * Multi-tenant: All operations scoped to tenant schema
 */

import type { PoolClient } from 'pg';
import { createAuditLog } from '../audit/enhancedAuditService';
import { getErrorMessage } from '../../utils/errorUtils';

export interface ClassInput {
  name: string;
  description?: string;
  gradeLevel?: string;
  section?: string;
  departmentId?: string;
  capacity?: number;
  academicYear?: string;
  metadata?: Record<string, unknown>;
}

export interface ClassRecord {
  id: string;
  name: string;
  description: string | null;
  gradeLevel: string | null;
  section: string | null;
  departmentId: string | null;
  classTeacherId: string | null;
  capacity: number | null;
  academicYear: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  studentCount?: number;
  teacherName?: string;
}

/**
 * Create a new class
 */
export async function createClass(
  client: PoolClient,
  schemaName: string,
  input: ClassInput,
  actorId: string
): Promise<ClassRecord> {
  // Check for duplicate name
  const duplicateCheck = await client.query(
    `SELECT id FROM ${schemaName}.classes WHERE name = $1`,
    [input.name]
  );

  if ((duplicateCheck.rowCount ?? 0) > 0) {
    throw new Error(`Class with name "${input.name}" already exists`);
  }

  // Create class
  const result = await client.query<{
    id: string;
    name: string;
    description: string | null;
    grade_level: string | null;
    section: string | null;
    department_id: string | null;
    class_teacher_id: string | null;
    capacity: number | null;
    academic_year: string | null;
    metadata: Record<string, unknown>;
    created_at: Date;
    updated_at: Date;
  }>(
    `INSERT INTO ${schemaName}.classes 
     (name, description, grade_level, section, department_id, capacity, academic_year, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, name, description, grade_level, section, department_id, class_teacher_id, capacity, academic_year, metadata, created_at, updated_at`,
    [
      input.name,
      input.description || null,
      input.gradeLevel || null,
      input.section || null,
      input.departmentId || null,
      input.capacity || null,
      input.academicYear || null,
      JSON.stringify(input.metadata || {})
    ]
  );

  const classRecord = result.rows[0];

  // Audit log
  await createAuditLog(client, {
    userId: actorId,
    action: 'class:create',
    resourceType: 'class',
    resourceId: classRecord.id,
    details: { name: input.name, gradeLevel: input.gradeLevel },
    severity: 'info',
    tags: ['class', 'admin']
  });

  return {
    id: classRecord.id,
    name: classRecord.name,
    description: classRecord.description,
    gradeLevel: classRecord.grade_level,
    section: classRecord.section,
    departmentId: classRecord.department_id,
    classTeacherId: classRecord.class_teacher_id,
    capacity: classRecord.capacity,
    academicYear: classRecord.academic_year,
    metadata: classRecord.metadata,
    createdAt: classRecord.created_at,
    updatedAt: classRecord.updated_at
  };
}

/**
 * List all classes with optional counts
 */
export async function listClasses(
  client: PoolClient,
  schemaName: string,
  includeCounts: boolean = true
): Promise<ClassRecord[]> {
  if (includeCounts) {
    const result = await client.query<{
      id: string;
      name: string;
      description: string | null;
      grade_level: string | null;
      section: string | null;
      department_id: string | null;
      class_teacher_id: string | null;
      capacity: number | null;
      academic_year: string | null;
      metadata: Record<string, unknown>;
      created_at: Date;
      updated_at: Date;
      student_count: string;
      teacher_name: string | null;
    }>(
      `SELECT 
        c.id, c.name, c.description, c.grade_level, c.section, c.department_id,
        c.class_teacher_id, c.capacity, c.academic_year, c.metadata, c.created_at, c.updated_at,
        COUNT(DISTINCT s.id)::text as student_count,
        u.full_name as teacher_name
       FROM ${schemaName}.classes c
       LEFT JOIN ${schemaName}.students s ON s.class_uuid = c.id
       LEFT JOIN shared.users u ON u.id = c.class_teacher_id
       GROUP BY c.id, c.name, c.description, c.grade_level, c.section, c.department_id,
                c.class_teacher_id, c.capacity, c.academic_year, c.metadata, c.created_at, c.updated_at, u.full_name
       ORDER BY c.grade_level, c.name`,
      []
    );

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      gradeLevel: row.grade_level,
      section: row.section,
      departmentId: row.department_id,
      classTeacherId: row.class_teacher_id,
      capacity: row.capacity,
      academicYear: row.academic_year,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      studentCount: Number(row.student_count),
      teacherName: row.teacher_name || undefined
    }));
  } else {
    const result = await client.query<{
      id: string;
      name: string;
      description: string | null;
      grade_level: string | null;
      section: string | null;
      department_id: string | null;
      class_teacher_id: string | null;
      capacity: number | null;
      academic_year: string | null;
      metadata: Record<string, unknown>;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id, name, description, grade_level, section, department_id, class_teacher_id, capacity, academic_year, metadata, created_at, updated_at
       FROM ${schemaName}.classes
       ORDER BY grade_level, name`,
      []
    );

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      gradeLevel: row.grade_level,
      section: row.section,
      departmentId: row.department_id,
      classTeacherId: row.class_teacher_id,
      capacity: row.capacity,
      academicYear: row.academic_year,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }
}

/**
 * Get class by ID
 */
export async function getClassById(
  client: PoolClient,
  schemaName: string,
  classId: string
): Promise<ClassRecord | null> {
  const result = await client.query<{
    id: string;
    name: string;
    description: string | null;
    grade_level: string | null;
    section: string | null;
    department_id: string | null;
    class_teacher_id: string | null;
    capacity: number | null;
    academic_year: string | null;
    metadata: Record<string, unknown>;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT id, name, description, grade_level, section, department_id, class_teacher_id, capacity, academic_year, metadata, created_at, updated_at
     FROM ${schemaName}.classes
     WHERE id = $1`,
    [classId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    gradeLevel: row.grade_level,
    section: row.section,
    departmentId: row.department_id,
    classTeacherId: row.class_teacher_id,
    capacity: row.capacity,
    academicYear: row.academic_year,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Update class
 */
export async function updateClass(
  client: PoolClient,
  schemaName: string,
  classId: string,
  input: Partial<ClassInput>,
  actorId: string
): Promise<ClassRecord> {
  // Check class exists
  const existing = await getClassById(client, schemaName, classId);
  if (!existing) {
    throw new Error('Class not found');
  }

  // Check for duplicate name if name is being updated
  if (input.name && input.name !== existing.name) {
    const duplicateCheck = await client.query(
      `SELECT id FROM ${schemaName}.classes WHERE name = $1 AND id != $2`,
      [input.name, classId]
    );
    if ((duplicateCheck.rowCount ?? 0) > 0) {
      throw new Error(`Class with name "${input.name}" already exists`);
    }
  }

  // Build update query
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(input.name);
  }
  if (input.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(input.description || null);
  }
  if (input.gradeLevel !== undefined) {
    updates.push(`grade_level = $${paramIndex++}`);
    values.push(input.gradeLevel || null);
  }
  if (input.section !== undefined) {
    updates.push(`section = $${paramIndex++}`);
    values.push(input.section || null);
  }
  if (input.departmentId !== undefined) {
    updates.push(`department_id = $${paramIndex++}`);
    values.push(input.departmentId || null);
  }
  if (input.capacity !== undefined) {
    updates.push(`capacity = $${paramIndex++}`);
    values.push(input.capacity || null);
  }
  if (input.academicYear !== undefined) {
    updates.push(`academic_year = $${paramIndex++}`);
    values.push(input.academicYear || null);
  }
  if (input.metadata !== undefined) {
    updates.push(`metadata = $${paramIndex++}`);
    values.push(JSON.stringify(input.metadata));
  }

  if (updates.length === 0) {
    return existing;
  }

  updates.push(`updated_at = NOW()`);
  values.push(classId);

  const result = await client.query<{
    id: string;
    name: string;
    description: string | null;
    grade_level: string | null;
    section: string | null;
    department_id: string | null;
    class_teacher_id: string | null;
    capacity: number | null;
    academic_year: string | null;
    metadata: Record<string, unknown>;
    created_at: Date;
    updated_at: Date;
  }>(
    `UPDATE ${schemaName}.classes
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex++}
     RETURNING id, name, description, grade_level, section, department_id, class_teacher_id, capacity, academic_year, metadata, created_at, updated_at`,
    values
  );

  const updated = result.rows[0];

  // Audit log
  await createAuditLog(client, {
    userId: actorId,
    action: 'class:update',
    resourceType: 'class',
    resourceId: classId,
    details: { updates: input },
    severity: 'info',
    tags: ['class', 'admin']
  });

  return {
    id: updated.id,
    name: updated.name,
    description: updated.description,
    gradeLevel: updated.grade_level,
    section: updated.section,
    departmentId: updated.department_id,
    classTeacherId: updated.class_teacher_id,
    capacity: updated.capacity,
    academicYear: updated.academic_year,
    metadata: updated.metadata,
    createdAt: updated.created_at,
    updatedAt: updated.updated_at
  };
}

/**
 * Delete class
 */
export async function deleteClass(
  client: PoolClient,
  schemaName: string,
  classId: string,
  actorId: string
): Promise<void> {
  // Check class exists
  const existing = await getClassById(client, schemaName, classId);
  if (!existing) {
    throw new Error('Class not found');
  }

  // Check if class has students
  const studentCheck = await client.query(
    `SELECT COUNT(*) as count FROM ${schemaName}.students WHERE class_uuid = $1`,
    [classId]
  );
  const studentCount = Number(studentCheck.rows[0]?.count ?? 0);
  if (studentCount > 0) {
    throw new Error(`Cannot delete class: ${studentCount} student(s) are enrolled in this class`);
  }

  await client.query(
    `DELETE FROM ${schemaName}.classes WHERE id = $1`,
    [classId]
  );

  // Audit log
  await createAuditLog(client, {
    userId: actorId,
    action: 'class:delete',
    resourceType: 'class',
    resourceId: classId,
    details: { name: existing.name },
    severity: 'info',
    tags: ['class', 'admin']
  });
}

/**
 * Assign class teacher
 */
export async function assignClassTeacher(
  client: PoolClient,
  schemaName: string,
  classId: string,
  teacherUserId: string,
  actorId: string
): Promise<void> {
  // Verify class exists
  const classRecord = await getClassById(client, schemaName, classId);
  if (!classRecord) {
    throw new Error('Class not found');
  }

  // Verify teacher exists and is a teacher
  const teacherCheck = await client.query(
    `SELECT id, role FROM shared.users WHERE id = $1 AND role = 'teacher'`,
    [teacherUserId]
  );
  if (teacherCheck.rows.length === 0) {
    throw new Error('Teacher not found');
  }

  // Update class
  await client.query(
    `UPDATE ${schemaName}.classes SET class_teacher_id = $1, updated_at = NOW() WHERE id = $2`,
    [teacherUserId, classId]
  );

  // Audit log
  await createAuditLog(client, {
    userId: actorId,
    action: 'class:assign_teacher',
    resourceType: 'class',
    resourceId: classId,
    details: { teacherUserId, className: classRecord.name },
    severity: 'info',
    tags: ['class', 'teacher', 'admin']
  });
}

/**
 * Assign students to class
 */
export async function assignStudentsToClass(
  client: PoolClient,
  schemaName: string,
  classId: string,
  studentIds: string[],
  actorId: string
): Promise<{ assigned: number; failed: number }> {
  // Verify class exists
  const classRecord = await getClassById(client, schemaName, classId);
  if (!classRecord) {
    throw new Error('Class not found');
  }

  let assigned = 0;
  let failed = 0;

  for (const studentId of studentIds) {
    try {
      // Verify student exists
      const studentCheck = await client.query(
        `SELECT id FROM ${schemaName}.students WHERE id = $1`,
        [studentId]
      );
      if (studentCheck.rows.length === 0) {
        failed++;
        continue;
      }

      // Update student's class
      await client.query(
        `UPDATE ${schemaName}.students SET class_uuid = $1, updated_at = NOW() WHERE id = $2`,
        [classId, studentId]
      );
      assigned++;
    } catch (error) {
      failed++;
      console.error(`Failed to assign student ${studentId} to class:`, getErrorMessage(error));
    }
  }

  // Audit log
  await createAuditLog(client, {
    userId: actorId,
    action: 'class:assign_students',
    resourceType: 'class',
    resourceId: classId,
    details: { studentIds, assigned, failed, className: classRecord.name },
    severity: 'info',
    tags: ['class', 'students', 'admin']
  });

  return { assigned, failed };
}

