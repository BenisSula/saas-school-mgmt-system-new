import type { PoolClient } from 'pg';
import { BrandingInput } from '../validators/brandingValidator';

const table = 'branding_settings';

export async function getBranding(client: PoolClient) {
  const result = await client.query(`SELECT * FROM ${table} ORDER BY updated_at DESC LIMIT 1`);
  return result.rows[0] ?? null;
}

export async function upsertBranding(client: PoolClient, payload: BrandingInput) {
  const existing = await getBranding(client);

  if (!existing) {
    const result = await client.query(
      `
        INSERT INTO ${table} (logo_url, primary_color, secondary_color, theme_flags)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [
        payload.logoUrl ?? null,
        payload.primaryColor ?? null,
        payload.secondaryColor ?? null,
        JSON.stringify(payload.themeFlags ?? {})
      ]
    );

    return result.rows[0];
  }

  const result = await client.query(
    `
      UPDATE ${table}
      SET logo_url = $1,
          primary_color = $2,
          secondary_color = $3,
          theme_flags = $4,
          updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `,
    [
      payload.logoUrl ?? existing.logo_url,
      payload.primaryColor ?? existing.primary_color,
      payload.secondaryColor ?? existing.secondary_color,
      JSON.stringify(payload.themeFlags ?? existing.theme_flags ?? {}),
      existing.id
    ]
  );

  return result.rows[0];
}

