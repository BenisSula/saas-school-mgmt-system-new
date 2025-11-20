/**
 * @deprecated This script has been disabled - seed data removed from application
 * Use seedSuperUserOnly.ts to create only the superuser account
 * To seed superuser, run: npm run seed:superuser
 */

async function main(): Promise<void> {
  console.warn('⚠️  WARNING: Demo seed script is deprecated. Seed data has been removed.');
  console.warn('⚠️  This script will not create any demo data.');
  console.warn('⚠️  Use seedSuperUserOnly.ts to create only the superuser account.');
  console.warn('⚠️  To seed superuser, run: npm run seed:superuser');
  process.exitCode = 0;
  return;
}

main();
