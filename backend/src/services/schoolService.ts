import type { PoolClient } from 'pg';
import { SchoolInput } from '../validators/schoolValidator';

const table = 'schools';

export async function getSchool(client: PoolClient) {
  const result = await client.query(`SELECT * FROM ${table} ORDER BY created_at ASC LIMIT 1`);
  return result.rows[0] ?? null;
}

export async function upsertSchool(client: PoolClient, payload: SchoolInput) {
  const existing = await getSchool(client);

  if (!existing) {
    const result = await client.query(
      `
        INSERT INTO ${table} (name, address)
        VALUES ($1, $2)
        RETURNING *
      `,
      [payload.name, JSON.stringify(payload.address ?? {})]
    );

    return result.rows[0];
  }

  const result = await client.query(
    `
      UPDATE ${table}
      SET name = $1,
          address = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `,
    [
      payload.name ?? existing.name,
      JSON.stringify(payload.address ?? existing.address ?? {}),
      existing.id
    ]
  );

  return result.rows[0];
}

