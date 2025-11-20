/**
 * Generic script to fix tenant admin setup for ANY school/tenant
 * Usage: 
 *   ts-node src/scripts/fixTenantAdmin.ts <tenant-identifier> <admin-email> [admin-password]
 * 
 * Examples:
 *   ts-node src/scripts/fixTenantAdmin.ts "New Horizon Senior Secondary School" fatou.jallow@newhorizon.edu.gm
 *   ts-node src/scripts/fixTenantAdmin.ts tenant_st_peters_senior_secondary_school admin@stpeters.edu.gm
 *   ts-node src/scripts/fixTenantAdmin.ts d757e5b4-4753-474d-9a9c-a4e6d74496a5 admin@school.edu.gm NewPassword@2025
 */

import { getPool } from '../db/connection';
import argon2 from 'argon2';
import crypto from 'crypto';

interface FixTenantAdminOptions {
  tenantIdentifier: string; // Can be tenant name, schema_name, or tenant ID
  adminEmail: string;
  adminPassword?: string; // Optional - only updates if provided
}

async function fixTenantAdmin(options: FixTenantAdminOptions) {
  const { tenantIdentifier, adminEmail, adminPassword } = options;
  const pool = getPool();
  const client = await pool.connect();

  try {
    console.log(`🔧 Fixing tenant admin setup...\n`);
    console.log(`   Tenant: ${tenantIdentifier}`);
    console.log(`   Admin Email: ${adminEmail}\n`);

    // 1. Find tenant by name, schema_name, or ID
    const tenantResult = await client.query(
      `SELECT id, schema_name, name FROM shared.tenants 
       WHERE name = $1 OR schema_name = $1 OR id::text = $1`,
      [tenantIdentifier]
    );

    if (tenantResult.rowCount === 0) {
      console.error(`❌ Tenant not found: ${tenantIdentifier}`);
      console.log('\nAvailable tenants:');
      const allTenants = await client.query(`SELECT id, name, schema_name FROM shared.tenants ORDER BY name`);
      allTenants.rows.forEach((t) => {
        console.log(`   - ${t.name} (ID: ${t.id}, Schema: ${t.schema_name})`);
      });
      return;
    }

    const tenant = tenantResult.rows[0];
    console.log('✅ Tenant found:');
    console.log(`   ID: ${tenant.id}`);
    console.log(`   Name: ${tenant.name}`);
    console.log(`   Schema: ${tenant.schema_name}\n`);

    // 2. Find or create admin user
    const adminResult = await client.query(
      `SELECT id, email, role, tenant_id, status, is_verified, password_hash 
       FROM shared.users WHERE email = $1`,
      [adminEmail.toLowerCase()]
    );

    if (adminResult.rowCount === 0) {
      if (!adminPassword) {
        console.error('❌ Admin user not found and no password provided.');
        console.log('   Please provide a password to create the admin user.');
        return;
      }

      console.log('⚠️  Admin user not found. Creating...\n');
      
      // Create admin user
      const passwordHash = await argon2.hash(adminPassword);
      const adminId = crypto.randomUUID();
      
      await client.query(
        `INSERT INTO shared.users (id, email, password_hash, role, tenant_id, is_verified, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [adminId, adminEmail.toLowerCase(), passwordHash, 'admin', tenant.id, true, 'active']
      );
      
      console.log('✅ Admin user created\n');
    } else {
      const admin = adminResult.rows[0];
      console.log('✅ Admin user found:', admin.email);
      
      // Fix tenant_id if wrong
      if (admin.tenant_id !== tenant.id) {
        console.warn('⚠️  Admin tenant_id mismatch. Fixing...');
        await client.query(
          `UPDATE shared.users SET tenant_id = $1 WHERE id = $2`,
          [tenant.id, admin.id]
        );
        console.log('✅ Updated admin tenant_id\n');
      }
      
      // Ensure admin is active and verified
      if (admin.status !== 'active' || !admin.is_verified) {
        console.warn('⚠️  Admin not active/verified. Fixing...');
        await client.query(
          `UPDATE shared.users SET status = 'active', is_verified = true WHERE id = $1`,
          [admin.id]
        );
        console.log('✅ Updated admin status\n');
      }
      
      // Update password if provided
      if (adminPassword) {
        const passwordValid = await argon2.verify(admin.password_hash, adminPassword);
        if (!passwordValid) {
          console.warn('⚠️  Password mismatch. Updating...');
          const newHash = await argon2.hash(adminPassword);
          await client.query(
            `UPDATE shared.users SET password_hash = $1 WHERE id = $2`,
            [newHash, admin.id]
          );
          console.log('✅ Updated admin password\n');
        } else {
          console.log('✅ Password is correct\n');
        }
      }
    }

    // 3. Verify tenant schema has data
    const tenantClient = await pool.connect();
    await tenantClient.query(`SET search_path TO ${tenant.schema_name}, public`);

    try {
      // Check users count
      const usersCount = await client.query(
        `SELECT COUNT(*) as count FROM shared.users WHERE tenant_id = $1`,
        [tenant.id]
      );
      console.log(`📊 Users in tenant: ${usersCount.rows[0].count}`);

      // Check teachers
      const teachersCount = await tenantClient.query(
        `SELECT COUNT(*) as count FROM ${tenant.schema_name}.teachers`
      );
      console.log(`📊 Teachers in schema: ${teachersCount.rows[0].count}`);

      // Check students
      const studentsCount = await tenantClient.query(
        `SELECT COUNT(*) as count FROM ${tenant.schema_name}.students`
      );
      console.log(`📊 Students in schema: ${studentsCount.rows[0].count}`);

      // Check classes
      const classesCount = await tenantClient.query(
        `SELECT COUNT(*) as count FROM ${tenant.schema_name}.classes`
      );
      console.log(`📊 Classes in schema: ${classesCount.rows[0].count}\n`);

    } finally {
      tenantClient.release();
    }

    console.log('✅ Fix complete!\n');
    console.log('Admin credentials:');
    console.log(`  Email: ${adminEmail}`);
    if (adminPassword) {
      console.log(`  Password: ${adminPassword}`);
    }
    console.log(`  Tenant: ${tenant.name}`);
    console.log(`  Tenant ID: ${tenant.id}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: ts-node fixTenantAdmin.ts <tenant-identifier> <admin-email> [admin-password]');
    console.error('\nExamples:');
    console.error('  ts-node fixTenantAdmin.ts "New Horizon Senior Secondary School" fatou.jallow@newhorizon.edu.gm');
    console.error('  ts-node fixTenantAdmin.ts tenant_st_peters_senior_secondary_school admin@stpeters.edu.gm');
    console.error('  ts-node fixTenantAdmin.ts d757e5b4-4753-474d-9a9c-a4e6d74496a5 admin@school.edu.gm NewPassword@2025');
    process.exit(1);
  }

  const [tenantIdentifier, adminEmail, adminPassword] = args;

  fixTenantAdmin({
    tenantIdentifier,
    adminEmail,
    adminPassword
  })
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

export { fixTenantAdmin };

