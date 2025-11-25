/**
 * Script to add DROP TRIGGER IF EXISTS before CREATE TRIGGER in migrations
 */

import { promises as fs } from 'fs';
import path from 'path';

async function fixMigrationTriggers(): Promise<void> {
  const migrationsDir = path.resolve(__dirname, '../db/migrations');
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files\n`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    let content = await fs.readFile(filePath, 'utf-8');
    const originalContent = content;

    // Match CREATE TRIGGER statements and add DROP TRIGGER IF EXISTS before them
    // Pattern: CREATE TRIGGER trigger_name ... ON table_name
    content = content.replace(
      /CREATE TRIGGER\s+(\w+)\s+.*?ON\s+([\w.]+)/gs,
      (match, triggerName, tableName) => {
        // Check if DROP TRIGGER already exists before this CREATE
        const beforeMatch = content.substring(0, content.indexOf(match));
        if (!beforeMatch.includes(`DROP TRIGGER IF EXISTS ${triggerName} ON ${tableName}`)) {
          return `DROP TRIGGER IF EXISTS ${triggerName} ON ${tableName};\nCREATE TRIGGER ${triggerName} ${match.replace(`CREATE TRIGGER ${triggerName} `, '')}`;
        }
        return match;
      }
    );

    // Simpler approach: Add DROP TRIGGER before each CREATE TRIGGER
    const triggerRegex = /CREATE TRIGGER\s+(\w+)\s+.*?ON\s+([\w.]+)/g;
    let match;
    const replacements: Array<{ old: string; new: string }> = [];

    while ((match = triggerRegex.exec(content)) !== null) {
      const triggerName = match[1];
      const tableName = match[2];
      const startPos = match.index;

      // Check if DROP already exists before this CREATE
      const beforeText = content.substring(Math.max(0, startPos - 200), startPos);
      if (!beforeText.includes(`DROP TRIGGER IF EXISTS ${triggerName} ON ${tableName}`)) {
        // Find the end of the CREATE TRIGGER statement (ends with semicolon or function call)
        const afterMatch = content.substring(startPos);
        const endMatch = afterMatch.match(/EXECUTE FUNCTION\s+\w+\(\);/);
        if (endMatch && endMatch.index !== undefined) {
          const endPos = startPos + endMatch.index + endMatch[0].length;
          const fullTrigger = content.substring(startPos, endPos);
          const dropStatement = `DROP TRIGGER IF EXISTS ${triggerName} ON ${tableName};\n`;
          replacements.push({
            old: fullTrigger,
            new: dropStatement + fullTrigger
          });
        }
      }
    }

    // Apply replacements in reverse order to maintain positions
    for (let i = replacements.length - 1; i >= 0; i--) {
      content = content.replace(replacements[i].old, replacements[i].new);
    }

    if (content !== originalContent) {
      await fs.writeFile(filePath, content, 'utf-8');
      console.log(`✅ Fixed: ${file}`);
    } else {
      console.log(`⏭️  Skipped: ${file} (no triggers or already fixed)`);
    }
  }

  console.log('\n✅ All migrations fixed!');
}

fixMigrationTriggers().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

