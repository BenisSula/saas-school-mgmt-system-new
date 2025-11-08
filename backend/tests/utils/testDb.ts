import crypto from 'crypto';
import { DataType, newDb } from 'pg-mem';
import type { Pool } from 'pg';
import { runMigrations } from '../../src/db/runMigrations';

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

  const { Pool: MemPool } = db.adapters.createPg();
  const pool = new MemPool() as unknown as Pool;

  await runMigrations(pool);

  return { pool };
}

