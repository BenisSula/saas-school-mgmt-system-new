/**
 * Generic script to verify tenant data for ANY school/tenant
 * Usage: 
 *   ts-node src/scripts/verifyTenantData.ts <tenant-identifier> [admin-email]
 * 
 * Examples:
 *   ts-node src/scripts/verifyTenantData.ts "New Horizon Senior Secondary School"
 *   ts-node src/scripts/verifyTenantData.ts tenant_st_peters_senior_secondary_school
 *   ts-node src/scripts/verifyTenantData.ts d757e5b4-4753-474d-9a9c-a4e6d74496a5 fatou.jallow@newhorizon.edu.gm
 */

import { getPool } from '../db/connection';
import { listTenantUsers } from '../services/userService';
import { listTeachers } from '../services/teacherService';
import { listStudents } from '../services/studentService';
import { getSchool } from '../services/schoolService';

interface VerifyTenantDataOptions {
  tenantIdentifier: string; // Can be tenant name, schema_name, or tenant ID
  adminEmail?: string; // Optional - verify specific admin user
}

async function verifyTenantData(options: VerifyTenantDataOptions) {
  const { tenantIdentifier, adminEmail } = options;
  const pool = getPool();
  const client = await pool.connect();

  try {
    console.log(`🔍 Verifying tenant data...\n`);
    console.log(`   Tenant: ${tenantIdentifier}`);
    if (adminEmail) {
      console.log(`   Admin Email: ${adminEmail}\n`);
    } else {
      console.log('');
    }

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

    // 2. Verify admin user if provided
    let adminInfo: { email: string; status: string | null } | null = null;
    if (adminEmail) {
      const adminResult = await client.query(
        `SELECT id, email, role, tenant_id, status, is_verified FROM shared.users WHERE email = $1`,
        [adminEmail.toLowerCase()]
      );

      if (adminResult.rowCount === 0) {
        console.error(`❌ Admin user not found: ${adminEmail}`);
        return;
      }

      const admin = adminResult.rows[0];
      adminInfo = { email: admin.email, status: admin.status };
      console.log('✅ Admin user found:');
      console.log(`   ID: ${admin.id}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Tenant ID: ${admin.tenant_id}`);
      console.log(`   Status: ${admin.status || 'null'}`);
      console.log(`   Verified: ${admin.is_verified}\n`);

      // Check if tenant_id matches
      if (admin.tenant_id !== tenant.id) {
        console.warn('⚠️  Admin tenant_id does not match tenant!');
        console.log(`   Admin tenant_id: ${admin.tenant_id}`);
        console.log(`   Tenant id: ${tenant.id}`);
        console.log('   Run fixTenantAdmin script to fix this.\n');
      }
    }

    // 3. Get tenant client with schema set
    const tenantClient = await pool.connect();
    await tenantClient.query(`SET search_path TO ${tenant.schema_name}, public`);

    try {
      // 4. Count users in shared.users for this tenant
      const usersCountResult = await client.query(
        `SELECT COUNT(*) as count FROM shared.users WHERE tenant_id = $1`,
        [tenant.id]
      );
      const usersCount = parseInt(usersCountResult.rows[0].count);
      console.log(`📊 Users in shared.users: ${usersCount}\n`);

      // 5. List users via service
      const users = await listTenantUsers(tenant.id);
      console.log(`📊 Users via service: ${users.length}`);
      console.log(`   Active: ${users.filter((u) => u.status === 'active').length}`);
      console.log(`   Pending: ${users.filter((u) => u.status === 'pending').length}`);
      console.log(`   Teachers: ${users.filter((u) => u.role === 'teacher').length}`);
      console.log(`   Students: ${users.filter((u) => u.role === 'student').length}`);
      console.log(`   Admins: ${users.filter((u) => u.role === 'admin').length}\n`);

      // 6. Check teachers in tenant schema
      const teachers = await listTeachers(tenantClient, tenant.schema_name);
      console.log(`📊 Teachers in tenant schema: ${teachers.length}`);
      if (teachers.length > 0) {
        console.log('   Sample teachers:');
        teachers.slice(0, 5).forEach((t) => {
          console.log(`     - ${t.name} (${t.email})`);
        });
      }
      console.log('');

      // 7. Check students in tenant schema
      const students = await listStudents(tenantClient, tenant.schema_name);
      console.log(`📊 Students in tenant schema: ${students.length}`);
      if (students.length > 0) {
        console.log('   Sample students:');
        students.slice(0, 5).forEach((s) => {
          console.log(`     - ${s.first_name} ${s.last_name} (${s.admission_number || 'no admission #'})`);
        });
      }
      console.log('');

      // 8. Check school record
      const school = await getSchool(tenantClient, tenant.schema_name);
      if (school) {
        console.log(`✅ School record found: ${school.name}\n`);
      } else {
        console.warn('⚠️  No school record found in tenant schema\n');
      }

      // 9. Check for HODs
      const hodsResult = await client.query(
        `
        SELECT u.id, u.email, u.role, ur.role_name, ur.metadata
        FROM shared.users u
        LEFT JOIN shared.user_roles ur ON ur.user_id = u.id
        WHERE u.tenant_id = $1 
          AND u.role = 'teacher'
          AND (ur.role_name = 'hod' OR ur.metadata::text LIKE '%hod%')
        `,
        [tenant.id]
      );
      const hodsCount = hodsResult.rowCount ?? 0;
      console.log(`📊 HODs: ${hodsCount}`);
      if (hodsCount > 0) {
        hodsResult.rows.forEach((hod) => {
          console.log(`     - ${hod.email}`);
        });
      }
      console.log('');

      // 10. Summary
      console.log('📋 Summary:');
      console.log(`   ✅ Tenant: ${tenant.name}`);
      if (adminInfo) {
        console.log(`   ✅ Admin: ${adminInfo.email} (${adminInfo.status || 'null'})`);
      }
      console.log(`   ✅ Users: ${users.length} total`);
      console.log(`   ✅ Teachers: ${teachers.length} in schema`);
      console.log(`   ✅ Students: ${students.length} in schema`);
      console.log(`   ✅ HODs: ${hodsCount}`);
      console.log(`   ${school ? '✅' : '⚠️ '} School record: ${school ? school.name : 'missing'}\n`);

      // 11. Recommendations
      if (users.length === 0) {
        console.warn('⚠️  No users found! Check if users are properly linked to tenant.');
      }
      if (teachers.length === 0) {
        console.warn('⚠️  No teachers found! Check if teacher records exist in tenant schema.');
      }
      if (students.length === 0) {
        console.warn('⚠️  No students found! Check if student records exist in tenant schema.');
      }
      if (!school) {
        console.warn('⚠️  No school record! Consider creating one.');
      }

    } finally {
      tenantClient.release();
    }

    console.log('✅ Verification complete!\n');
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
  
  if (args.length < 1) {
    console.error('Usage: ts-node verifyTenantData.ts <tenant-identifier> [admin-email]');
    console.error('\nExamples:');
    console.error('  ts-node verifyTenantData.ts "New Horizon Senior Secondary School"');
    console.error('  ts-node verifyTenantData.ts tenant_st_peters_senior_secondary_school');
    console.error('  ts-node verifyTenantData.ts d757e5b4-4753-474d-9a9c-a4e6d74496a5 fatou.jallow@newhorizon.edu.gm');
    process.exit(1);
  }

  const [tenantIdentifier, adminEmail] = args;

  verifyTenantData({
    tenantIdentifier,
    adminEmail
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

export { verifyTenantData };

