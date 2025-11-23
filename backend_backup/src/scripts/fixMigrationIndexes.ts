/**
 * Script to add IF NOT EXISTS to all CREATE INDEX statements in migrations
 * This fixes the issue where migrations fail because indexes already exist
 */

import { promises as fs } from 'fs';
import path from 'path';

async function fixMigrationIndexes(): Promise<void> {
  const migrationsDir = path.resolve(__dirname, '../db/migrations');
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files\n`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    let content = await fs.readFile(filePath, 'utf-8');
    const originalContent = content;

    // Replace CREATE INDEX with CREATE INDEX IF NOT EXISTS
    // But skip if it already has IF NOT EXISTS
    content = content.replace(
      /CREATE INDEX\s+(?!IF NOT EXISTS)(\w+)/g,
      'CREATE INDEX IF NOT EXISTS $1'
    );

    if (content !== originalContent) {
      await fs.writeFile(filePath, content, 'utf-8');
      console.log(`✅ Fixed: ${file}`);
    } else {
      console.log(`⏭️  Skipped: ${file} (already has IF NOT EXISTS or no indexes)`);
    }
  }

  console.log('\n✅ All migrations fixed!');
}

fixMigrationIndexes().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

