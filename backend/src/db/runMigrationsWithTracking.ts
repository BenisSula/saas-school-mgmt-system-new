/**
 * Enhanced migration runner with tracking
 * Tracks which migrations have been executed to avoid re-running them
 *
 * Usage: Replace runMigrations with runMigrationsWithTracking in migrate.ts
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { Pool } from 'pg';

/**
 * Creates the migration tracking table if it doesn't exist
 */
async function ensureMigrationTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shared.schema_migrations (
      migration_file TEXT PRIMARY KEY,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      execution_time_ms INTEGER,
      error_message TEXT
    )
  `);

  // Create index for faster lookups
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_schema_migrations_file 
    ON shared.schema_migrations(migration_file)
  `);
}

/**
 * Check if a migration has already been executed
 */
async function isMigrationExecuted(pool: Pool, migrationFile: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT 1 FROM shared.schema_migrations WHERE migration_file = $1',
    [migrationFile]
  );
  return result.rows.length > 0;
}

/**
 * Record that a migration has been executed
 */
async function recordMigrationExecution(
  pool: Pool,
  migrationFile: string,
  executionTimeMs: number,
  errorMessage?: string
): Promise<void> {
  if (errorMessage) {
    await pool.query(
      `INSERT INTO shared.schema_migrations (migration_file, execution_time_ms, error_message)
       VALUES ($1, $2, $3)
       ON CONFLICT (migration_file) 
       DO UPDATE SET execution_time_ms = $2, error_message = $3`,
      [migrationFile, executionTimeMs, errorMessage]
    );
  } else {
    await pool.query(
      `INSERT INTO shared.schema_migrations (migration_file, execution_time_ms)
       VALUES ($1, $2)
       ON CONFLICT (migration_file) DO NOTHING`,
      [migrationFile, executionTimeMs]
    );
  }
}

/**
 * Get list of executed migrations
 */
export async function getExecutedMigrations(pool: Pool): Promise<string[]> {
  const result = await pool.query(
    'SELECT migration_file FROM shared.schema_migrations ORDER BY executed_at'
  );
  return result.rows.map((row) => row.migration_file);
}

/**
 * Enhanced migration runner with tracking
 * Only runs migrations that haven't been executed yet
 */
export async function runMigrationsWithTracking(pool: Pool, skipDoBlocks = false): Promise<void> {
  // Ensure tracking table exists
  await ensureMigrationTable(pool);

  const migrationsDir = path.resolve(__dirname, 'migrations');
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();

  let executedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  console.log(`\n📋 Found ${files.length} migration file(s)\n`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);

    // Check if already executed
    const alreadyExecuted = await isMigrationExecuted(pool, file);
    if (alreadyExecuted) {
      console.log(`⏭️  Skipping ${file} (already executed)`);
      skippedCount++;
      continue;
    }

    // Read and prepare SQL
    let sql = await fs.readFile(filePath, 'utf-8');

    // Remove DO blocks if requested (for pg-mem compatibility)
    if (skipDoBlocks) {
      sql = sql.replace(/DO\s+\$\$[\s\S]*?\$\$;/g, '-- DO block removed');
    }

    // Execute migration
    const startTime = Date.now();
    try {
      console.log(`🔄 Running migration: ${file}...`);
      await pool.query(sql);
      const executionTime = Date.now() - startTime;
      await recordMigrationExecution(pool, file, executionTime);
      console.log(`✅ Migration ${file} completed (${executionTime}ms)`);
      executedCount++;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      await recordMigrationExecution(pool, file, executionTime, errorMessage);
      console.error(`\n❌ Migration failed: ${file}`);
      console.error(`Error: ${errorMessage}`);
      if (error instanceof Error && 'code' in error) {
        console.error(`PostgreSQL Error Code: ${(error as { code?: string }).code}`);
      }
      failedCount++;
      throw new Error(`Migration ${file} failed: ${errorMessage}`);
    }
  }

  // Summary
  console.log(`\n📊 Migration Summary:`);
  console.log(`   ✅ Executed: ${executedCount}`);
  console.log(`   ⏭️  Skipped: ${skippedCount}`);
  if (failedCount > 0) {
    console.log(`   ❌ Failed: ${failedCount}`);
  }
  console.log(`   📁 Total: ${files.length}\n`);
}
