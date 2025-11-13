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
  const result = await client.query(
    `
      INSERT INTO ${tableName(schema)} (first_name, last_name, date_of_birth, class_id, admission_number, parent_contacts)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      payload.firstName,
      payload.lastName,
      payload.dateOfBirth ?? null,
      payload.classId ?? null,
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

  const next = {
    first_name: payload.firstName ?? existing.first_name,
    last_name: payload.lastName ?? existing.last_name,
    date_of_birth: payload.dateOfBirth ?? existing.date_of_birth,
    class_id: payload.classId ?? existing.class_id,
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
          admission_number = $5,
          parent_contacts = $6,
          updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `,
    [
      next.first_name,
      next.last_name,
      next.date_of_birth,
      next.class_id,
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

  const result = await client.query(
    `
      UPDATE ${tableName(schema)}
      SET class_id = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `,
    [classId, id]
  );

  return {
    previousClassId: existing.class_id as string | null,
    student: result.rows[0]
  };
}
