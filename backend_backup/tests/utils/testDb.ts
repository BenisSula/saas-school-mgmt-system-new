import crypto from 'crypto';
import { DataType, newDb } from 'pg-mem';
import type { Pool } from 'pg';
import { runMigrations } from '../../src/db/runMigrations';
import { runTenantMigrations } from '../../src/db/tenantManager';

export async function createTestPool(): Promise<{ pool: Pool }> {
  const db = newDb({
    autoCreateForeignKeyIndices: true,
    noAstCoverageCheck: true
  });

  db.registerExtension('uuid-ossp', (schema) => {
    schema.registerFunction({
      name: 'uuid_generate_v4',
      returns: DataType.uuid,
      implementation: () => crypto.randomUUID()
    });
  });

  // Note: pg-mem doesn't fully support plpgsql DO blocks
  // Tests that require full migration support should use a real PostgreSQL database
  // For now, we'll let migrations fail gracefully and tests will need to handle this

  const { Pool: MemPool } = db.adapters.createPg();
  const pool = new MemPool() as unknown as Pool;

  // Skip DO blocks for pg-mem compatibility
  await runMigrations(pool, true);
  await pool.query('CREATE SCHEMA tenant_alpha');
  await runTenantMigrations(pool, 'tenant_alpha');

  return { pool };
}
