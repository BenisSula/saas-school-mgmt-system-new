import { closePool, getPool } from '../db/connection';
import { runMigrations } from '../db/runMigrations';
import { getDemoSeedContext, seedDemoTenant } from '../seed/demoTenant';

async function main(): Promise<void> {
  const pool = getPool();

  try {
    await runMigrations(pool);
    await seedDemoTenant(pool);
    const context = getDemoSeedContext();
    console.log('Demo tenant seeded successfully.');
    console.log('SuperUser login:', context.superuserEmail, context.superuserPassword);
    console.log('Admin login:', context.adminEmail, context.adminPassword);
    console.log('Teacher login:', context.teacherEmail, context.teacherPassword);
    console.log('Tenant schema:', context.tenantSchema);
  } catch (error) {
    console.error('Failed to seed demo tenant', error);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

main();
