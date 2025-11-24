/**
 * Script to check student count for New Horizon Senior Secondary School
 * Run with: npx ts-node backend/src/scripts/checkNewHorizonStudents.ts
 */

import 'dotenv/config';
import { getPool, closePool } from '../db/connection';
import { getTenantClient } from '../db/connection';

async function checkNewHorizonStudents() {
  const pool = getPool();

  try {
    // Find New Horizon tenant
    const tenantResult = await pool.query(
      `SELECT id, schema_name, name 
       FROM shared.tenants 
       WHERE name ILIKE '%New Horizon%' OR name ILIKE '%new horizon%'
       LIMIT 1`
    );

    if (tenantResult.rows.length === 0) {
      console.log('❌ New Horizon tenant not found in database');
      return;
    }

    const tenant = tenantResult.rows[0];
    console.log(`\n✅ Found tenant: ${tenant.name}`);
    console.log(`   Tenant ID: ${tenant.id}`);
    console.log(`   Schema: ${tenant.schema_name}\n`);

    // Get tenant client
    const tenantClient = await getTenantClient(tenant.id);

    try {
      // Count students in students table
      const studentsCount = await tenantClient.query(
        `SELECT COUNT(*)::int as count FROM ${tenant.schema_name}.students`
      );
      const studentCount = studentsCount.rows[0]?.count || 0;

      // Count users with student role
      const usersCount = await pool.query(
        `SELECT COUNT(*)::int as count 
         FROM shared.users 
         WHERE tenant_id = $1 AND role = 'student'`,
        [tenant.id]
      );
      const userStudentCount = usersCount.rows[0]?.count || 0;

      // Get school info
      const schoolResult = await tenantClient.query(
        `SELECT id, name, address FROM ${tenant.schema_name}.schools LIMIT 1`
      );
      const school = schoolResult.rows[0];

      console.log('📊 Student Counts:');
      console.log(`   Students table: ${studentCount} students`);
      console.log(`   Users table (role='student'): ${userStudentCount} users`);
      console.log(`\n🏫 School Info:`);
      console.log(`   Name: ${school?.name || 'Not found'}`);
      console.log(`   ID: ${school?.id || 'Not found'}`);

      // List first 5 students
      const studentsList = await tenantClient.query(
        `SELECT id, first_name, last_name, admission_number, enrollment_status, class_id
         FROM ${tenant.schema_name}.students 
         ORDER BY last_name, first_name 
         LIMIT 5`
      );

      if (studentsList.rows.length > 0) {
        console.log(`\n📝 Sample Students (first 5):`);
        studentsList.rows.forEach((s, i) => {
          console.log(
            `   ${i + 1}. ${s.first_name || ''} ${s.last_name || ''} (${s.admission_number || 'N/A'}) - ${s.enrollment_status || 'N/A'}`
          );
        });
      } else {
        console.log('\n⚠️  No students found in students table');
      }

      // Check if overview endpoint would return correct count
      console.log(`\n✅ Expected Overview Count: ${studentCount} students (from students table)`);
      console.log(`   This is the count that should appear on the dashboard\n`);
    } finally {
      tenantClient.release();
    }
  } catch (error) {
    console.error('❌ Error checking students:', error);
    throw error;
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  checkNewHorizonStudents()
    .then(() => {
      console.log('✅ Check complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed:', error);
      process.exit(1);
    });
}

export { checkNewHorizonStudents };
