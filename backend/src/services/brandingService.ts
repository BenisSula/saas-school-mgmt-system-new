import type { PoolClient } from 'pg';
import { BrandingInput } from '../validators/brandingValidator';
import { getTableName, serializeJsonField } from '../lib/serviceUtils';

const table = 'branding_settings';

export async function getBranding(client: PoolClient, schema: string) {
  const result = await client.query(
    `SELECT * FROM ${getTableName(schema, table)} ORDER BY updated_at DESC LIMIT 1`
  );
  return result.rows[0] ?? null;
}

export async function upsertBranding(client: PoolClient, schema: string, payload: BrandingInput) {
  const existing = await getBranding(client, schema);

  if (!existing) {
    const result = await client.query(
      `
        INSERT INTO ${getTableName(schema, table)} (logo_url, primary_color, secondary_color, theme_flags, typography, navigation)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        payload.logoUrl ?? null,
        payload.primaryColor ?? null,
        payload.secondaryColor ?? null,
        serializeJsonField(payload.themeFlags ?? {}),
        serializeJsonField(payload.typography ?? {}),
        serializeJsonField(payload.navigation ?? {}),
      ]
    );

    return result.rows[0];
  }

  const result = await client.query(
    `
      UPDATE ${getTableName(schema, table)}
      SET logo_url = $1,
          primary_color = $2,
          secondary_color = $3,
          theme_flags = $4,
          typography = $5,
          navigation = $6,
          updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `,
    [
      payload.logoUrl ?? existing.logo_url,
      payload.primaryColor ?? existing.primary_color,
      payload.secondaryColor ?? existing.secondary_color,
      serializeJsonField(payload.themeFlags ?? existing.theme_flags ?? {}),
      serializeJsonField(payload.typography ?? existing.typography ?? {}),
      serializeJsonField(payload.navigation ?? existing.navigation ?? {}),
      existing.id,
    ]
  );

  return result.rows[0];
}
