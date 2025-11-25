import type { PoolClient } from 'pg';
import { StudentInput } from '../validators/studentValidator';
import { getTableName, serializeJsonField } from '../lib/serviceUtils';
import { resolveClassId, getEntityById, deleteEntityById } from '../lib/crudHelpers';
// listEntities not used in this file but may be needed for future implementations
import { createAuditLog } from './audit/enhancedAuditService';

const table = 'students';

export async function listStudents(
  client: PoolClient,
  schema: string,
  filters?: {
    enrollmentStatus?: string;
    classId?: string;
    search?: string;
  }
) {
  const tableName = getTableName(schema, table);
  let query = `SELECT * FROM ${tableName}`;
  const params: unknown[] = [];
  const conditions: string[] = [];
  let paramIndex = 1;

  if (filters) {
    if (filters.enrollmentStatus) {
      conditions.push(`enrollment_status = $${paramIndex}`);
      params.push(filters.enrollmentStatus);
      paramIndex++;
    }
    if (filters.classId) {
      conditions.push(`(class_id = $${paramIndex} OR class_uuid = $${paramIndex})`);
      params.push(filters.classId);
      paramIndex++;
    }
    if (filters.search) {
      conditions.push(`(
        LOWER(first_name || ' ' || last_name) LIKE $${paramIndex}
        OR LOWER(admission_number) LIKE $${paramIndex}
        OR LOWER(class_id) LIKE $${paramIndex}
      )`);
      params.push(`%${filters.search.toLowerCase()}%`);
      paramIndex++;
    }
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ` ORDER BY last_name, first_name`;

  const result = await client.query(query, params);
  return result.rows;
}

export async function getStudent<T = Record<string, unknown>>(
  client: PoolClient,
  schema: string,
  id: string
): Promise<T | null> {
  return getEntityById<T>(client, schema, table, id);
}

export async function createStudent(
  client: PoolClient,
  schema: string,
  payload: StudentInput,
  actorId?: string,
  tenantId?: string
) {
  // Resolve classId to both class_id (name) and class_uuid (UUID)
  const { classIdName, classUuid } = await resolveClassId(client, schema, payload.classId);

  const tableName = getTableName(schema, table);
  const result = await client.query(
    `
      INSERT INTO ${tableName} (first_name, last_name, date_of_birth, class_id, class_uuid, admission_number, parent_contacts)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [
      payload.firstName,
      payload.lastName,
      payload.dateOfBirth ?? null,
      classIdName,
      classUuid,
      payload.admissionNumber ?? null,
      serializeJsonField(payload.parentContacts ?? [])
    ]
  );

  const studentId = result.rows[0].id;

  // Create audit log for student creation
  if (actorId && tenantId) {
    try {
      await createAuditLog(client, {
        tenantId: tenantId,
        userId: actorId,
        action: 'STUDENT_CREATED',
        resourceType: 'student',
        resourceId: studentId,
        details: {
          studentEmail: (payload as { email?: string }).email,
          classId: classIdName,
          classUuid: classUuid
        },
        severity: 'info'
      });
    } catch (auditError) {
      console.error(
        '[studentService] Failed to create audit log for student creation:',
        auditError
      );
    }
  }

  return result.rows[0];
}

export async function updateStudent(
  client: PoolClient,
  schema: string,
  id: string,
  payload: Partial<StudentInput>
) {
  const existing = await getStudent<{
    class_id: string | null;
    class_uuid: string | null;
    first_name: string;
    last_name: string;
    date_of_birth: string | null;
    admission_number: string | null;
    parent_contacts: unknown;
  }>(client, schema, id);
  if (!existing) {
    return null;
  }

  // If classId is provided, resolve it to both class_id (name) and class_uuid (UUID)
  const resolved = await resolveClassId(client, schema, payload.classId);
  const classIdName = resolved.classIdName ?? existing.class_id;
  const classUuid = resolved.classUuid ?? existing.class_uuid;

  const next = {
    first_name: payload.firstName ?? existing.first_name,
    last_name: payload.lastName ?? existing.last_name,
    date_of_birth: payload.dateOfBirth ?? existing.date_of_birth,
    class_id: classIdName,
    class_uuid: classUuid,
    admission_number: payload.admissionNumber ?? existing.admission_number,
    parent_contacts: serializeJsonField(payload.parentContacts ?? existing.parent_contacts)
  };

  const tableName = getTableName(schema, table);
  const result = await client.query(
    `
      UPDATE ${tableName}
      SET first_name = $1,
          last_name = $2,
          date_of_birth = $3,
          class_id = $4,
          class_uuid = $5,
          admission_number = $6,
          parent_contacts = $7,
          updated_at = NOW()
      WHERE id = $8
      RETURNING *
    `,
    [
      next.first_name,
      next.last_name,
      next.date_of_birth,
      next.class_id,
      next.class_uuid,
      next.admission_number,
      next.parent_contacts,
      id
    ]
  );

  return result.rows[0];
}

export async function deleteStudent(client: PoolClient, schema: string, id: string) {
  return deleteEntityById(client, schema, table, id);
}

export async function moveStudentToClass(
  client: PoolClient,
  schema: string,
  id: string,
  classId: string
) {
  const existing = await getStudent<{
    class_id: string | null;
    class_uuid: string | null;
  }>(client, schema, id);
  if (!existing) {
    return null;
  }

  // Resolve classId to both class_id (name) and class_uuid (UUID)
  const { classIdName, classUuid } = await resolveClassId(client, schema, classId);

  const tableName = getTableName(schema, table);
  const result = await client.query(
    `
      UPDATE ${tableName}
      SET class_id = $1,
          class_uuid = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `,
    [classIdName, classUuid, id]
  );

  return {
    previousClassId: existing.class_id as string | null,
    previousClassUuid: existing.class_uuid as string | null,
    student: result.rows[0]
  };
}

export async function getStudentClassRoster(client: PoolClient, schema: string, studentId: string) {
  const tableName = getTableName(schema, table);

  // Get the student's class_uuid
  const studentResult = await client.query<{ class_uuid: string | null }>(
    `SELECT class_uuid FROM ${tableName} WHERE id = $1`,
    [studentId]
  );

  if (studentResult.rows.length === 0 || !studentResult.rows[0].class_uuid) {
    return null;
  }

  const classUuid = studentResult.rows[0].class_uuid;

  // Get all students in the same class
  const result = await client.query(
    `
      SELECT id,
             first_name,
             last_name,
             admission_number,
             class_id
      FROM ${tableName}
      WHERE class_uuid = $1
      ORDER BY last_name ASC, first_name ASC
    `,
    [classUuid]
  );

  return result.rows.map((row) => ({
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    admission_number: row.admission_number,
    class_id: row.class_id
  }));
}
