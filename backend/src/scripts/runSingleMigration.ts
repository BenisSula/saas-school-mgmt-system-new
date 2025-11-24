/**
 * Script to run a single migration file
 * Usage: ts-node src/scripts/runSingleMigration.ts <migration-filename>
 * Example: ts-node src/scripts/runSingleMigration.ts 023_add_enrollment_status_to_students.sql
 */

import { getPool, closePool } from '../db/connection';
import { promises as fs } from 'fs';
import path from 'path';

async function runSingleMigration(migrationFileName: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const migrationsDir = path.resolve(__dirname, '..', 'db', 'migrations');
    const migrationPath = path.join(migrationsDir, migrationFileName);

    console.log(`Reading migration file: ${migrationPath}`);
    const sql = await fs.readFile(migrationPath, 'utf-8');

    console.log(`Executing migration: ${migrationFileName}`);
    await client.query(sql);

    console.log(`✅ Migration ${migrationFileName} completed successfully.`);
  } catch (error) {
    console.error(`❌ Migration ${migrationFileName} failed:`, error);
    throw error;
  } finally {
    client.release();
    await closePool();
  }
}

const migrationFileName = process.argv[2];

if (!migrationFileName) {
  console.error('Usage: ts-node src/scripts/runSingleMigration.ts <migration-filename>');
  console.error(
    'Example: ts-node src/scripts/runSingleMigration.ts 023_add_enrollment_status_to_students.sql'
  );
  process.exit(1);
}

runSingleMigration(migrationFileName).catch((error) => {
  console.error('Migration script failed:', error);
  process.exit(1);
});
