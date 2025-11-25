import type { PoolClient } from 'pg';
import { SchoolInput } from '../validators/schoolValidator';
import { getTableName, serializeJsonField } from '../lib/serviceUtils';

const table = 'schools';

export async function getSchool(client: PoolClient, schema: string) {
  const result = await client.query(
    `SELECT * FROM ${getTableName(schema, table)} ORDER BY created_at ASC LIMIT 1`
  );
  return result.rows[0] ?? null;
}

export async function upsertSchool(client: PoolClient, schema: string, payload: SchoolInput) {
  const existing = await getSchool(client, schema);

  if (!existing) {
    const result = await client.query(
      `
        INSERT INTO ${getTableName(schema, table)} (name, address)
        VALUES ($1, $2)
        RETURNING *
      `,
      [payload.name, serializeJsonField(payload.address ?? {})]
    );

    return result.rows[0];
  }

  const result = await client.query(
    `
      UPDATE ${getTableName(schema, table)}
      SET name = $1,
          address = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `,
    [
      payload.name ?? existing.name,
      serializeJsonField(payload.address ?? existing.address ?? {}),
      existing.id
    ]
  );

  return result.rows[0];
}
