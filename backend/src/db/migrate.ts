import { getPool, closePool } from './connection';
import { runMigrations as runMigrationsOnPool } from './runMigrations';
import { runTenantMigrations } from './tenantManager';

async function executeMigrations(): Promise<void> {
  const pool = getPool();

  try {
    // Step 1: Run shared migrations
    console.log('📋 Running shared migrations...\n');
    await runMigrationsOnPool(pool);
    console.log('\n✅ Shared migrations completed successfully.\n');

    // Step 2: Run tenant migrations for all existing tenants
    console.log('📋 Running tenant migrations for all tenants...\n');
    const result = await pool.query(`
      SELECT id, name, schema_name 
      FROM shared.tenants 
      WHERE status != 'deleted'
      ORDER BY created_at
    `);

    const tenants = result.rows;
    console.log(`Found ${tenants.length} tenant(s) to migrate\n`);

    if (tenants.length === 0) {
      console.log('ℹ️  No tenants found. Tenant migrations will run automatically when tenants are created.\n');
    } else {
      let successCount = 0;
      let errorCount = 0;

      for (const tenant of tenants) {
        try {
          console.log(`🔄 Running tenant migrations for: ${tenant.name} (${tenant.schema_name})...`);
          await runTenantMigrations(pool, tenant.schema_name);
          console.log(`✅ Tenant migrations completed for: ${tenant.name}\n`);
          successCount++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`❌ Failed to run tenant migrations for ${tenant.name}: ${errorMsg}\n`);
          errorCount++;
        }
      }

      console.log('=== Tenant Migration Summary ===');
      console.log(`Total tenants: ${tenants.length}`);
      console.log(`✅ Successful: ${successCount}`);
      if (errorCount > 0) {
        console.log(`❌ Failed: ${errorCount}`);
      }
      console.log('');

      if (errorCount > 0) {
        console.error('⚠️  Some tenant migrations failed. Please review the errors above.');
        process.exit(1);
      }
    }

    console.log('✅ All migrations completed successfully!');
  } finally {
    await closePool();
  }
}

executeMigrations().catch((error) => {
  console.error('Migration failed', error);
  process.exit(1);
});
