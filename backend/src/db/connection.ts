import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

let pool: Pool | undefined;

function resolveConnectionString(): string {
  const explicitUrl = process.env.DATABASE_URL;
  if (explicitUrl && explicitUrl.trim().length > 0) {
    return explicitUrl;
  }
  const fallbackUrl = 'postgres://postgres:postgres@localhost:5432/saas_school';
  if (process.env.NODE_ENV !== 'test') {
    console.warn(
      `[db] DATABASE_URL not set. Falling back to default local connection: ${fallbackUrl}`
    );
  }
  return fallbackUrl;
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: resolveConnectionString(),
      max: process.env.DB_POOL_SIZE ? Number(process.env.DB_POOL_SIZE) : 10,
      ssl:
        process.env.DB_SSL === 'true'
          ? {
              rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
            }
          : false,
    });
  }

  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

/**
 * Get a tenant database client with search path set
 * @param tenantId - The tenant ID
 * @returns A PoolClient with the tenant schema search path set
 */
export async function getTenantClient(tenantId: string): Promise<import('pg').PoolClient> {
  const pool = getPool();
  const client = await pool.connect();

  // Get tenant schema
  const tenantResult = await pool.query<{ schema_name: string }>(
    'SELECT schema_name FROM shared.tenants WHERE id = $1',
    [tenantId]
  );

  if (tenantResult.rows.length === 0) {
    client.release();
    throw new Error(`Tenant ${tenantId} not found`);
  }

  const schemaName = tenantResult.rows[0].schema_name;
  await client.query(`SET search_path TO ${schemaName}, public`);

  return client;
}
