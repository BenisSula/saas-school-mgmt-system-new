/**
 * Data Migration Script: Consolidate Class Resources
 * 
 * Migrates existing class_resources data from old schema (027) to unified schema (033)
 * 
 * Usage:
 *   ts-node scripts/migrate-class-resources-data.ts
 */

import { getPool, getTenantClient } from '../backend/src/db/connection';

interface OldClassResource {
  id: string;
  tenant_id: string;
  teacher_id: string;
  class_id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string;
  size: number;
  created_at: Date;
  updated_at: Date;
}

async function migrateClassResourcesData() {
  console.log('🔄 Starting class resources data migration...\n');

  const pool = getPool();

  try {
    // Get all active tenants
    const tenantsResult = await pool.query(
      `SELECT id, schema_name FROM shared.tenants WHERE status = 'active'`
    );

    if (tenantsResult.rows.length === 0) {
      console.log('⚠️  No active tenants found.');
      return;
    }

    console.log(`📋 Found ${tenantsResult.rows.length} active tenant(s)\n`);

    for (const tenant of tenantsResult.rows) {
      console.log(`\n🔍 Processing tenant: ${tenant.schema_name} (${tenant.id})`);

      const tenantClient = await getTenantClient(tenant.id);

      try {
        // Check if class_resources table exists
        const tableExists = await tenantClient.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = $1 
            AND table_name = 'class_resources'
          )`,
          [tenant.schema_name]
        );

        if (!tableExists.rows[0].exists) {
          console.log(`  ⏭️  No class_resources table found, skipping...`);
          tenantClient.release();
          continue;
        }

        // Check if migration is needed (has old columns but missing new ones)
        const hasOldColumns = await tenantClient.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = $1 
            AND table_name = 'class_resources' 
            AND column_name = 'teacher_id'
          )`,
          [tenant.schema_name]
        );

        const hasNewColumns = await tenantClient.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = $1 
            AND table_name = 'class_resources' 
            AND column_name = 'resource_type'
          )`,
          [tenant.schema_name]
        );

        if (!hasOldColumns.rows[0].exists && hasNewColumns.rows[0].exists) {
          console.log(`  ✅ Already using new schema, skipping migration...`);
          tenantClient.release();
          continue;
        }

        if (!hasOldColumns.rows[0].exists) {
          console.log(`  ⚠️  Table exists but has unexpected schema, skipping...`);
          tenantClient.release();
          continue;
        }

        // Get all resources that need migration
        const resourcesResult = await tenantClient.query<OldClassResource>(
          `SELECT * FROM ${tenant.schema_name}.class_resources 
           WHERE resource_type IS NULL OR resource_url IS NULL`
        );

        if (resourcesResult.rows.length === 0) {
          console.log(`  ✅ No resources need migration`);
          tenantClient.release();
          continue;
        }

        console.log(`  📦 Found ${resourcesResult.rows.length} resource(s) to migrate`);

        let migrated = 0;
        let errors = 0;

        for (const resource of resourcesResult.rows) {
          try {
            // Determine resource_type from file_type
            let resourceType = 'document';
            if (resource.file_type.startsWith('video/')) {
              resourceType = 'video';
            } else if (resource.file_type.startsWith('image/')) {
              resourceType = 'file';
            } else if (resource.file_url.startsWith('http://') || resource.file_url.startsWith('https://')) {
              resourceType = 'link';
            }

            // Extract file_name from file_url if possible
            const fileName = resource.file_url.includes('/')
              ? resource.file_url.split('/').pop() || null
              : null;

            // Get created_by from teacher_id
            const userResult = await tenantClient.query(
              `SELECT id FROM shared.users 
               WHERE tenant_id = $1 
               AND id IN (SELECT id FROM ${tenant.schema_name}.teachers WHERE id = $2)
               LIMIT 1`,
              [tenant.id, resource.teacher_id]
            );

            const createdBy = userResult.rows[0]?.id || null;

            // Update resource with new schema fields
            await tenantClient.query(
              `UPDATE ${tenant.schema_name}.class_resources
               SET 
                 resource_type = $1,
                 resource_url = COALESCE(resource_url, file_url),
                 file_name = COALESCE(file_name, $2),
                 file_size = COALESCE(file_size, size),
                 mime_type = COALESCE(mime_type, file_type),
                 created_by = COALESCE(created_by, $3),
                 updated_by = COALESCE(updated_by, $3)
               WHERE id = $4`,
              [resourceType, fileName, createdBy, resource.id]
            );

            migrated++;
          } catch (error) {
            console.error(`  ❌ Error migrating resource ${resource.id}:`, error);
            errors++;
          }
        }

        console.log(`  ✅ Migrated ${migrated} resource(s), ${errors} error(s)`);
        tenantClient.release();
      } catch (error) {
        tenantClient.release();
        console.error(`  ❌ Error processing tenant ${tenant.schema_name}:`, error);
      }
    }

    console.log('\n✨ Migration complete!\n');
  } catch (error) {
    console.error('❌ Fatal error during migration:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  migrateClassResourcesData()
    .then(() => {
      console.log('✅ Data migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

export { migrateClassResourcesData };

