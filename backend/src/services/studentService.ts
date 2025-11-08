import type { PoolClient } from 'pg';
import { StudentInput } from '../validators/studentValidator';

const table = 'students';

export async function listStudents(client: PoolClient) {
  const result = await client.query(`SELECT * FROM ${table} ORDER BY created_at DESC`);
  return result.rows;
}

export async function getStudent(client: PoolClient, id: string) {
  const result = await client.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  return result.rows[0];
}

export async function createStudent(client: PoolClient, payload: StudentInput) {
  const result = await client.query(
    `
      INSERT INTO ${table} (first_name, last_name, date_of_birth, class_id, admission_number, parent_contacts)
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

export async function updateStudent(client: PoolClient, id: string, payload: Partial<StudentInput>) {
  const existing = await getStudent(client, id);
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
      UPDATE ${table}
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

export async function deleteStudent(client: PoolClient, id: string) {
  await client.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
}

