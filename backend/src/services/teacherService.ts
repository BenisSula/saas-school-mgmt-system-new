import type { PoolClient } from 'pg';
import { TeacherInput } from '../validators/teacherValidator';
import { getTableName, serializeJsonField } from '../lib/serviceUtils';
import { getEntityById, deleteEntityById } from '../lib/crudHelpers';

const table = 'teachers';

export async function listTeachers(
  client: PoolClient,
  schema: string,
  options?: {
    limit?: number;
    offset?: number;
    search?: string;
  }
) {
  const params: unknown[] = [];
  const conditions: string[] = [];
  let paramIndex = 1;

  if (options?.search) {
    conditions.push(`(LOWER(name) LIKE $${paramIndex} OR LOWER(email) LIKE $${paramIndex})`);
    params.push(`%${options.search.toLowerCase()}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderBy = 'ORDER BY created_at DESC';

  let query = `SELECT * FROM ${getTableName(schema, table)} ${whereClause} ${orderBy}`;

  if (options?.limit) {
    query += ` LIMIT $${paramIndex}`;
    params.push(options.limit);
    paramIndex++;
  }

  if (options?.offset) {
    query += ` OFFSET $${paramIndex}`;
    params.push(options.offset);
  }

  const result = await client.query(query, params);
  return result.rows;
}

export async function getTeacher<T extends Record<string, unknown> = Record<string, unknown>>(
  client: PoolClient,
  schema: string,
  id: string
): Promise<T | null> {
  return getEntityById<T>(client, schema, table, id);
}

export async function getTeacherByEmail(client: PoolClient, schema: string, email: string) {
  const tableName = getTableName(schema, table);
  const result = await client.query(`SELECT * FROM ${tableName} WHERE email = $1 LIMIT 1`, [email]);
  return (result.rowCount ?? 0) > 0 ? result.rows[0] : null;
}

export async function createTeacher(client: PoolClient, schema: string, payload: TeacherInput) {
  const tableName = getTableName(schema, table);
  const result = await client.query(
    `
      INSERT INTO ${tableName} (name, email, subjects, assigned_classes)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [
      payload.name,
      payload.email,
      serializeJsonField(payload.subjects ?? []),
      serializeJsonField(payload.assignedClasses ?? []),
    ]
  );

  return result.rows[0];
}

export async function updateTeacher(
  client: PoolClient,
  schema: string,
  id: string,
  payload: Partial<TeacherInput>
) {
  const existing = await getTeacher<{
    name: string;
    email: string;
    subjects: unknown;
    assigned_classes: unknown;
  }>(client, schema, id);
  if (!existing) {
    return null;
  }

  const tableName = getTableName(schema, table);
  const next = {
    name: payload.name ?? existing.name,
    email: payload.email ?? existing.email,
    subjects: serializeJsonField(payload.subjects ?? existing.subjects),
    assigned_classes: serializeJsonField(payload.assignedClasses ?? existing.assigned_classes),
  };

  const result = await client.query(
    `
      UPDATE ${tableName}
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

export async function deleteTeacher(client: PoolClient, schema: string, id: string) {
  return deleteEntityById(client, schema, table, id);
}
