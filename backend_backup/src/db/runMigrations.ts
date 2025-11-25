import { promises as fs } from 'fs';
import path from 'path';
import type { Pool } from 'pg';

/**
 * Removes DO blocks from SQL for pg-mem compatibility
 */
function removeDoBlocks(sql: string): string {
  // Remove DO $$ ... END $$; blocks (used for plpgsql in migrations)
  // This is a workaround for pg-mem not supporting plpgsql
  return sql.replace(/DO\s+\$\$[\s\S]*?\$\$;/g, '-- DO block removed for test compatibility');
}

/**
 * Fixes problematic INSERT statements for pg-mem compatibility
 * pg-mem has issues with ON CONFLICT when the conflict column is nullable (like tenant_id = NULL)
 */
function fixPgMemInserts(sql: string): string {
  // Remove INSERT statements for password_policies with NULL tenant_id and ON CONFLICT
  // pg-mem doesn't handle ON CONFLICT with nullable columns well
  // This is safe because tests can insert their own test data if needed
  if (sql.includes('password_policies') && sql.includes('tenant_id') && sql.includes('ON CONFLICT')) {
    // Replace the problematic INSERT with a comment
    sql = sql.replace(
      /INSERT INTO shared\.password_policies[^;]*ON CONFLICT[^;]*;/gi,
      '-- INSERT INTO shared.password_policies skipped for pg-mem compatibility (nullable tenant_id ON CONFLICT)'
    );
  }
  return sql;
}

export async function runMigrations(pool: Pool, skipDoBlocks = false): Promise<void> {
  const migrationsDir = path.resolve(__dirname, 'migrations');
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    let sql = await fs.readFile(filePath, 'utf-8');

    // Remove DO blocks if requested (for pg-mem compatibility)
    if (skipDoBlocks) {
      sql = removeDoBlocks(sql);
      // Also fix problematic INSERT statements for pg-mem compatibility
      sql = fixPgMemInserts(sql);
    }

    try {
      console.log(`Running migration: ${file}...`);
      await pool.query(sql);
      console.log(`✅ Migration ${file} completed successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Migration failed: ${file}`);
      console.error(`Error: ${errorMessage}`);
      if (error instanceof Error && 'code' in error) {
        console.error(`PostgreSQL Error Code: ${(error as { code?: string }).code}`);
      }
      throw new Error(`Migration ${file} failed: ${errorMessage}`);
    }
  }
}
