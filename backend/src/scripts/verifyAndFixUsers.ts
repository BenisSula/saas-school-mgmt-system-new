import 'dotenv/config';
import { getPool, closePool } from '../db/connection';
import { withTenantSearchPath } from '../db/tenantManager';

async function findDuplicateUsers() {
  const pool = getPool();

  // Find duplicate emails
  const duplicateEmails = await pool.query(`
    SELECT email, COUNT(*) as count, array_agg(id) as user_ids
    FROM shared.users
    GROUP BY email
    HAVING COUNT(*) > 1
  `);

  console.log(`[verify] Found ${duplicateEmails.rowCount} duplicate emails`);

  // Find duplicate usernames (non-null)
  const duplicateUsernames = await pool.query(`
    SELECT username, COUNT(*) as count, array_agg(id) as user_ids
    FROM shared.users
    WHERE username IS NOT NULL
    GROUP BY username
    HAVING COUNT(*) > 1
  `);

  console.log(`[verify] Found ${duplicateUsernames.rowCount} duplicate usernames`);

  return { duplicateEmails: duplicateEmails.rows, duplicateUsernames: duplicateUsernames.rows };
}

async function countUsersByRole() {
  const pool = getPool();

  const result = await pool.query(`
    SELECT 
      role,
      COUNT(*) as count,
      COUNT(CASE WHEN is_verified = TRUE THEN 1 END) as verified_count,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count
    FROM shared.users
    GROUP BY role
    ORDER BY role
  `);

  console.log('\n[verify] User counts by role:');
  for (const row of result.rows) {
    console.log(
      `  ${row.role}: ${row.count} total, ${row.verified_count} verified, ${row.active_count} active`
    );
  }

  // Count HODs (users with hod role in user_roles)
  const hodCount = await pool.query(`
    SELECT COUNT(DISTINCT user_id) as count
    FROM shared.user_roles
    WHERE role_name = 'hod'
  `);
  console.log(`  HOD (via user_roles): ${hodCount.rows[0].count}`);

  return result.rows;
}

async function verifySeedUsers() {
  const pool = getPool();

  const expectedUsers = {
    superuser: ['owner@saas-platform.system'],
    admins: [
      'fatou.jallow@newhorizon.edu.gm',
      'lamin.sowe@stpeterslamin.edu.gm',
      'musu.bah@daddyjobe.edu.gm',
    ],
    hods: [
      'alhaji.saine@newhorizon.edu.gm',
      'mariama.camara@newhorizon.edu.gm',
      'joseph.ceesay@newhorizon.edu.gm',
      'hassan.njie@stpeterslamin.edu.gm',
      'abdoulie.touray@stpeterslamin.edu.gm',
      'ebrima.sanyang@stpeterslamin.edu.gm',
      'momodou.bojang@daddyjobe.edu.gm',
      'isatou.jatta@daddyjobe.edu.gm',
      'ousman.darboe@daddyjobe.edu.gm',
    ],
  };

  console.log('\n[verify] Checking seed users:');

  // Check superuser
  for (const email of expectedUsers.superuser) {
    const result = await pool.query(
      `SELECT id, email, role, is_verified, status FROM shared.users WHERE email = $1`,
      [email.toLowerCase()]
    );
    const rowCount = result.rowCount ?? 0;
    if (rowCount === 0) {
      console.log(`  ❌ Superuser ${email} NOT FOUND`);
    } else if (rowCount > 1) {
      console.log(`  ⚠️  Superuser ${email} has ${rowCount} entries`);
    } else {
      const user = result.rows[0];
      console.log(
        `  ✅ Superuser ${email}: ${user.role}, verified: ${user.is_verified}, status: ${user.status}`
      );
    }
  }

  // Check admins
  for (const email of expectedUsers.admins) {
    const result = await pool.query(
      `SELECT id, email, role, is_verified, status FROM shared.users WHERE email = $1`,
      [email.toLowerCase()]
    );
    const rowCount = result.rowCount ?? 0;
    if (rowCount === 0) {
      console.log(`  ❌ Admin ${email} NOT FOUND`);
    } else if (rowCount > 1) {
      console.log(`  ⚠️  Admin ${email} has ${rowCount} entries`);
    } else {
      const user = result.rows[0];
      console.log(
        `  ✅ Admin ${email}: ${user.role}, verified: ${user.is_verified}, status: ${user.status}`
      );
    }
  }

  // Check HODs
  for (const email of expectedUsers.hods) {
    const result = await pool.query(
      `SELECT id, email, role, is_verified, status FROM shared.users WHERE email = $1`,
      [email.toLowerCase()]
    );
    const rowCount = result.rowCount ?? 0;
    if (rowCount === 0) {
      console.log(`  ❌ HOD ${email} NOT FOUND`);
    } else if (rowCount > 1) {
      console.log(`  ⚠️  HOD ${email} has ${rowCount} entries`);
    } else {
      const user = result.rows[0];
      const hodRole = await pool.query(
        `SELECT role_name FROM shared.user_roles WHERE user_id = $1 AND role_name = 'hod'`,
        [user.id]
      );
      const hodRowCount = hodRole.rowCount ?? 0;
      console.log(
        `  ✅ HOD ${email}: ${user.role}, verified: ${user.is_verified}, status: ${user.status}, hod role: ${hodRowCount > 0 ? 'yes' : 'no'}`
      );
    }
  }
}

async function countTenantUsers() {
  const pool = getPool();

  const tenants = await pool.query(`
    SELECT id, name, schema_name FROM shared.tenants
  `);

  console.log('\n[verify] Tenant user counts:');
  for (const tenant of tenants.rows) {
    const userCount = await pool.query(
      `SELECT COUNT(*) as count FROM shared.users WHERE tenant_id = $1`,
      [tenant.id]
    );
    console.log(`  ${tenant.name} (${tenant.schema_name}): ${userCount.rows[0].count} users`);

    // Count students in tenant schema
    await withTenantSearchPath(pool, tenant.schema_name, async (client) => {
      const studentCount = await client.query(`SELECT COUNT(*) as count FROM students`);
      console.log(`    - Students in tenant: ${studentCount.rows[0].count}`);
    });
  }
}

async function main() {
  try {
    console.log('[verify] Starting user verification...\n');

    const duplicates = await findDuplicateUsers();
    await countUsersByRole();
    await verifySeedUsers();
    await countTenantUsers();

    if (duplicates.duplicateEmails.length > 0 || duplicates.duplicateUsernames.length > 0) {
      console.log('\n[verify] ⚠️  Duplicates found. Consider running cleanup script.');
    } else {
      console.log('\n[verify] ✅ No duplicates found.');
    }

    console.log('\n[verify] Verification complete.');
  } catch (error) {
    console.error('[verify] Error during verification:', error);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

main().catch((error) => {
  console.error('[verify] Unexpected failure', error);
  process.exit(1);
});
