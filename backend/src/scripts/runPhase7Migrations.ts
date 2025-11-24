/**
 * Script to run Phase 7 migrations for all existing tenants
 * Usage: ts-node src/scripts/runPhase7Migrations.ts
 */

import { getPool, closePool } from '../db/connection';
import { runTenantMigrations } from '../db/tenantManager';
import { listTenants } from '../services/shared/tenantQueries';

async function runPhase7Migrations(): Promise<void> {
  const pool = getPool();

  try {
    console.log('Fetching all tenants...');
    const tenants = await listTenants();
    console.log(`Found ${tenants.length} tenant(s)`);

    if (tenants.length === 0) {
      console.log('No tenants found. Migrations will run automatically for new tenants.');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const tenant of tenants) {
      try {
        console.log(`\nRunning migrations for tenant: ${tenant.id} (${tenant.schema_name})...`);
        await runTenantMigrations(pool, tenant.schema_name);
        console.log(`✅ Migrations completed for tenant: ${tenant.id}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to run migrations for tenant ${tenant.id}:`, error);
        errorCount++;
      }
    }

    console.log(`\n=== Migration Summary ===`);
    console.log(`Total tenants: ${tenants.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${errorCount}`);

    if (errorCount > 0) {
      console.error('\n⚠️  Some migrations failed. Please review the errors above.');
      process.exit(1);
    } else {
      console.log('\n✅ All migrations completed successfully!');
    }
  } catch (error) {
    console.error('Fatal error running migrations:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

runPhase7Migrations().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
