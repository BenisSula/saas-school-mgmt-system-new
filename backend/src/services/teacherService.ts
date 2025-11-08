import type { PoolClient } from 'pg';
import { TeacherInput } from '../validators/teacherValidator';

const table = 'teachers';

export async function listTeachers(client: PoolClient) {
  const result = await client.query(`SELECT * FROM ${table} ORDER BY created_at DESC`);
  return result.rows;
}

export async function getTeacher(client: PoolClient, id: string) {
  const result = await client.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  return result.rows[0];
}

export async function createTeacher(client: PoolClient, payload: TeacherInput) {
  const result = await client.query(
    `
      INSERT INTO ${table} (name, email, subjects, assigned_classes)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [payload.name, payload.email, JSON.stringify(payload.subjects ?? []), JSON.stringify(payload.assignedClasses ?? [])]
  );

  return result.rows[0];
}

export async function updateTeacher(client: PoolClient, id: string, payload: Partial<TeacherInput>) {
  const existing = await getTeacher(client, id);
  if (!existing) {
    return null;
  }

  const next = {
    name: payload.name ?? existing.name,
    email: payload.email ?? existing.email,
    subjects: JSON.stringify(payload.subjects ?? existing.subjects),
    assigned_classes: JSON.stringify(payload.assignedClasses ?? existing.assigned_classes)
  };

  const result = await client.query(
    `
      UPDATE ${table}
      SET name = $1,
          email = $2,
          subjects = $3,
          assigned_classes = $4,
          updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `,
    [next.name, next.email, next.subjects, next.assigned_classes, id]
  );

  return result.rows[0];
}

export async function deleteTeacher(client: PoolClient, id: string) {
  await client.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
}

