import type { PoolClient } from 'pg';
import { StudentInput } from '../validators/studentValidator';
import { assertValidSchemaName } from '../db/tenantManager';

const table = 'students';

function tableName(schema: string): string {
  assertValidSchemaName(schema);
  return `${schema}.${table}`;
}

export async function listStudents(client: PoolClient, schema: string) {
  const result = await client.query(`SELECT * FROM ${tableName(schema)} ORDER BY created_at DESC`);
  return result.rows;
}

export async function getStudent(client: PoolClient, schema: string, id: string) {
  const result = await client.query(`SELECT * FROM ${tableName(schema)} WHERE id = $1`, [id]);
  return result.rows[0];
}

export async function createStudent(client: PoolClient, schema: string, payload: StudentInput) {
  // Resolve classId to both class_id (name) and class_uuid (UUID)
  let classIdName: string | null = null;
  let classUuid: string | null = null;

  if (payload.classId) {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      payload.classId
    );

    if (isUUID) {
      // It's a UUID, fetch the class name
      const classResult = await client.query<{ id: string; name: string }>(
        `SELECT id, name FROM ${schema}.classes WHERE id = $1`,
        [payload.classId]
      );
      if (classResult.rows.length > 0) {
        classUuid = classResult.rows[0].id;
        classIdName = classResult.rows[0].name;
      }
    } else {
      // It's a name, find the class UUID
      const classResult = await client.query<{ id: string; name: string }>(
        `SELECT id, name FROM ${schema}.classes WHERE name = $1 LIMIT 1`,
        [payload.classId]
      );
      if (classResult.rows.length > 0) {
        classUuid = classResult.rows[0].id;
        classIdName = classResult.rows[0].name;
      } else {
        // Class not found, just set the name
        classIdName = payload.classId;
        classUuid = null;
      }
    }
  }

  const result = await client.query(
    `
      INSERT INTO ${tableName(schema)} (first_name, last_name, date_of_birth, class_id, class_uuid, admission_number, parent_contacts)
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
      JSON.stringify(payload.parentContacts ?? [])
    ]
  );

  return result.rows[0];
}

export async function updateStudent(
  client: PoolClient,
  schema: string,
  id: string,
  payload: Partial<StudentInput>
) {
  const existing = await getStudent(client, schema, id);
  if (!existing) {
    return null;
  }

  // If classId is provided, resolve it to both class_id (name) and class_uuid (UUID)
  let classIdName: string | null = existing.class_id;
  let classUuid: string | null = existing.class_uuid;

  if (payload.classId) {
    // Check if payload.classId is a UUID (class reference) or a name
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      payload.classId
    );

    if (isUUID) {
      // It's a UUID, fetch the class name
      const classResult = await client.query<{ id: string; name: string }>(
        `SELECT id, name FROM ${schema}.classes WHERE id = $1`,
        [payload.classId]
      );
      if (classResult.rows.length > 0) {
        classUuid = classResult.rows[0].id;
        classIdName = classResult.rows[0].name;
      }
    } else {
      // It's a name, find the class UUID
      const classResult = await client.query<{ id: string; name: string }>(
        `SELECT id, name FROM ${schema}.classes WHERE name = $1 LIMIT 1`,
        [payload.classId]
      );
      if (classResult.rows.length > 0) {
        classUuid = classResult.rows[0].id;
        classIdName = classResult.rows[0].name;
      } else {
        // Class not found, just set the name
        classIdName = payload.classId;
        classUuid = null;
      }
    }
  }

  const next = {
    first_name: payload.firstName ?? existing.first_name,
    last_name: payload.lastName ?? existing.last_name,
    date_of_birth: payload.dateOfBirth ?? existing.date_of_birth,
    class_id: classIdName,
    class_uuid: classUuid,
    admission_number: payload.admissionNumber ?? existing.admission_number,
    parent_contacts: JSON.stringify(payload.parentContacts ?? existing.parent_contacts)
  };

  const result = await client.query(
    `
      UPDATE ${tableName(schema)}
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
  await client.query(`DELETE FROM ${tableName(schema)} WHERE id = $1`, [id]);
}

export async function moveStudentToClass(
  client: PoolClient,
  schema: string,
  id: string,
  classId: string
) {
  const existing = await getStudent(client, schema, id);
  if (!existing) {
    return null;
  }

  // Resolve classId to both class_id (name) and class_uuid (UUID)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId);
  let classIdName: string | null = null;
  let classUuid: string | null = null;

  if (isUUID) {
    // It's a UUID, fetch the class name
    const classResult = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM ${schema}.classes WHERE id = $1`,
      [classId]
    );
    if (classResult.rows.length > 0) {
      classUuid = classResult.rows[0].id;
      classIdName = classResult.rows[0].name;
    }
  } else {
    // It's a name, find the class UUID
    const classResult = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM ${schema}.classes WHERE name = $1 LIMIT 1`,
      [classId]
    );
    if (classResult.rows.length > 0) {
      classUuid = classResult.rows[0].id;
      classIdName = classResult.rows[0].name;
    } else {
      // Class not found, just set the name
      classIdName = classId;
      classUuid = null;
    }
  }

  const result = await client.query(
    `
      UPDATE ${tableName(schema)}
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
  assertValidSchemaName(schema);

  // Get the student's class_uuid
  const studentResult = await client.query<{ class_uuid: string | null }>(
    `SELECT class_uuid FROM ${tableName(schema)} WHERE id = $1`,
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
      FROM ${tableName(schema)}
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
