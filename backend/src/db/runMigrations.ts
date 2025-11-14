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

export async function runMigrations(pool: Pool, skipDoBlocks = false): Promise<void> {
  const migrationsDir = path.resolve(__dirname, 'migrations');
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    let sql = await fs.readFile(filePath, 'utf-8');

    // Remove DO blocks if requested (for pg-mem compatibility)
    if (skipDoBlocks) {
      sql = removeDoBlocks(sql);
    }

    await pool.query(sql);
  }
}
