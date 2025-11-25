/**
 * CRUD Helper Functions
 * Consolidates common CRUD patterns to reduce duplication
 */

import type { PoolClient } from 'pg';
import { getTableName, serializeJsonField } from './serviceUtils';

/**
 * Generic list function
 */
export async function listEntities<T>(
  client: PoolClient,
  schema: string,
  table: string,
  options: {
    where?: string;
    orderBy?: string;
    limit?: number;
    offset?: number;
    params?: unknown[];
  } = {}
): Promise<T[]> {
  const tableName = getTableName(schema, table);
  const orderBy = options.orderBy || 'created_at DESC';
  let query = `SELECT * FROM ${tableName}`;
  const params: unknown[] = options.params || [];

  if (options.where) {
    query += ` WHERE ${options.where}`;
  }

  query += ` ORDER BY ${orderBy}`;

  if (options.limit) {
    query += ` LIMIT $${params.length + 1}`;
    params.push(options.limit);
  }

  if (options.offset) {
    query += ` OFFSET $${params.length + 1}`;
    params.push(options.offset);
  }

  const result = await client.query(query, params);
  return result.rows as T[];
}

/**
 * Generic get by ID function
 */
export async function getEntityById<T>(
  client: PoolClient,
  schema: string,
  table: string,
  id: string
): Promise<T | null> {
  const tableName = getTableName(schema, table);
  const result = await client.query(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);
  return (result.rows[0] as T) || null;
}

/**
 * Generic delete by ID function
 */
export async function deleteEntityById(
  client: PoolClient,
  schema: string,
  table: string,
  id: string
): Promise<void> {
  const tableName = getTableName(schema, table);
  await client.query(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
}

/**
 * Generic update function builder
 */
export function buildUpdateQuery(
  schema: string,
  table: string,
  id: string,
  updates: Record<string, unknown>,
  excludeFields: string[] = ['id', 'created_at']
): { query: string; params: unknown[] } {
  const tableName = getTableName(schema, table);
  const fields: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (excludeFields.includes(key)) continue;
    if (value === undefined) continue;

    fields.push(`${key} = $${paramIndex++}`);
    // Handle JSON fields
    if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
      params.push(serializeJsonField(value));
    } else {
      params.push(value);
    }
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  fields.push(`updated_at = NOW()`);
  params.push(id);

  const query = `
    UPDATE ${tableName}
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  return { query, params };
}

/**
 * Generic upsert helper (get or create pattern)
 */
export async function upsertEntity<T>(
  client: PoolClient,
  schema: string,
  table: string,
  findCondition: { field: string; value: unknown },
  insertData: Record<string, unknown>,
  updateData?: Record<string, unknown>
): Promise<T> {
  const tableName = getTableName(schema, table);

  // Try to find existing
  const existingResult = await client.query(
    `SELECT * FROM ${tableName} WHERE ${findCondition.field} = $1 LIMIT 1`,
    [findCondition.value]
  );

  if (existingResult.rows.length > 0) {
    // Update existing
    const updateFields = updateData || insertData;
    const { query, params } = buildUpdateQuery(schema, table, existingResult.rows[0].id, {
      ...existingResult.rows[0],
      ...updateFields,
    });
    const result = await client.query(query, params);
    return result.rows[0] as T;
  } else {
    // Insert new
    const fields = Object.keys(insertData);
    const values = fields.map((_, i) => `$${i + 1}`);
    const params = fields.map((field) => {
      const value = insertData[field];
      if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
        return serializeJsonField(value);
      }
      return value;
    });

    const result = await client.query(
      `
        INSERT INTO ${tableName} (${fields.join(', ')}, created_at)
        VALUES (${values.join(', ')}, NOW())
        RETURNING *
      `,
      params
    );
    return result.rows[0] as T;
  }
}

/**
 * Resolve class ID to both name and UUID
 * Consolidates duplicate classId resolution logic
 */
export async function resolveClassId(
  client: PoolClient,
  schema: string,
  classId: string | null | undefined
): Promise<{ classIdName: string | null; classUuid: string | null }> {
  if (!classId) {
    return { classIdName: null, classUuid: null };
  }

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId);

  if (isUUID) {
    // It's a UUID, fetch the class name
    const classResult = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM ${schema}.classes WHERE id = $1`,
      [classId]
    );
    if (classResult.rows.length > 0) {
      return {
        classUuid: classResult.rows[0].id,
        classIdName: classResult.rows[0].name,
      };
    }
  } else {
    // It's a name, find the class UUID
    const classResult = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM ${schema}.classes WHERE name = $1 LIMIT 1`,
      [classId]
    );
    if (classResult.rows.length > 0) {
      return {
        classUuid: classResult.rows[0].id,
        classIdName: classResult.rows[0].name,
      };
    } else {
      // Class not found, just set the name
      return {
        classIdName: classId,
        classUuid: null,
      };
    }
  }

  return { classIdName: null, classUuid: null };
}
