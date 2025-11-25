import { getPool, closePool } from './connection';
import { runMigrations as runMigrationsOnPool } from './runMigrations';

async function executeMigrations(): Promise<void> {
  const pool = getPool();

  try {
    await runMigrationsOnPool(pool);
    console.log('Migrations completed successfully.');
  } finally {
    await closePool();
  }
}

executeMigrations().catch((error) => {
  console.error('Migration failed', error);
  process.exit(1);
});

