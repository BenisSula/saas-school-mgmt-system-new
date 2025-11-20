import { Pool, PoolClient } from 'pg';
import fs from 'fs';
import path from 'path';
import { getPool } from './connection';
import crypto from 'crypto';

export function assertValidSchemaName(schemaName: string): void {
  if (!/^[a-zA-Z0-9_]+$/.test(schemaName)) {
    throw new Error('Invalid schema name');
  }
}

export function createSchemaSlug(name: string): string {
  return `tenant_${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')}`;
}

export interface TenantInput {
  name: string;
  domain?: string;
  schemaName: string;
  subscriptionType?: 'free' | 'trial' | 'paid';
  status?: 'active' | 'suspended' | 'deleted';
  billingEmail?: string | null;
}

export async function createTenantRecord(
  pool: Pool,
  { name, domain, schemaName, subscriptionType, status, billingEmail }: TenantInput
): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  const result = await pool.query(
    `
      INSERT INTO shared.tenants (id, name, domain, schema_name, subscription_type, status, billing_email)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `,
    [
      id,
      name,
      domain ?? null,
      schemaName,
      subscriptionType ?? 'trial',
      status ?? 'active',
      billingEmail ?? null
    ]
  );

  return { id: result.rows[0].id };
}

export async function createTenantSchema(pool: Pool, schemaName: string): Promise<void> {
  assertValidSchemaName(schemaName);
  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
}

export async function runTenantMigrations(pool: Pool, schemaName: string): Promise<void> {
  const migrationsDir = path.resolve(__dirname, 'migrations', 'tenants');
  let files: string[] = [];
  try {
    files = (await fs.promises.readdir(migrationsDir))
      .filter((file) => file.endsWith('.sql'))
      .sort();
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT'
    ) {
      return;
    }
    throw error;
  }

  const client = await pool.connect();
  try {
    assertValidSchemaName(schemaName);
    await client.query(`SET search_path TO ${schemaName}, public`);
    for (const file of files) {
      const sql = await fs.promises.readFile(path.join(migrationsDir, file), 'utf-8');
      const renderedSql = sql.replace(/{{schema}}/g, schemaName);
      const statements = renderedSql
        .split(/;\s*\n/)
        .map((statement) => statement.trim())
        .filter(Boolean);

      for (const statement of statements) {
        await client.query(statement);
      }
    }
  } finally {
    await client.query('SET search_path TO public');
    client.release();
  }
}

/**
 * Initialize tenant schema with minimal structure (no seed data)
 * Seed data has been removed - tenants start with empty structure
 */
export async function seedTenant(pool: Pool, schemaName: string): Promise<void> {
  const client = await pool.connect();
  try {
    assertValidSchemaName(schemaName);
    // Only create empty branding_settings record if it doesn't exist
    // No default colors or seed data
    await client.query(
      `
        INSERT INTO ${schemaName}.branding_settings (id, logo_url, primary_color, secondary_color, theme_flags)
        VALUES (uuid_generate_v4(), NULL, NULL, NULL, '{}'::jsonb)
        ON CONFLICT (id) DO NOTHING
      `
    );
    // Grade scales removed - admins should configure their own grading system
  } finally {
    client.release();
  }
}

export async function createTenant(input: TenantInput, poolParam?: Pool): Promise<{ id: string }> {
  const pool = poolParam ?? getPool();

  await createTenantSchema(pool, input.schemaName);
  await runTenantMigrations(pool, input.schemaName);
  await seedTenant(pool, input.schemaName);
  const tenant = await createTenantRecord(pool, input);

  return tenant;
}

export async function withTenantSearchPath<T>(
  pool: Pool,
  schemaName: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    assertValidSchemaName(schemaName);
    await client.query(`SET search_path TO ${schemaName}, public`);
    return await fn(client);
  } finally {
    await client.query('SET search_path TO public');
    client.release();
  }
}
