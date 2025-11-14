import 'dotenv/config';
import { getPool, closePool } from '../db/connection';
import { withTenantSearchPath } from '../db/tenantManager';

async function verifyAllSchools() {
  const pool = getPool();
  try {
    // Get all tenants
    const tenantsResult = await pool.query(`
      SELECT id, name, schema_name, status 
      FROM shared.tenants 
      ORDER BY name
    `);

    console.log(`\n[verify] Found ${tenantsResult.rowCount} tenant(s):\n`);

    for (const tenant of tenantsResult.rows) {
      console.log(`Tenant: ${tenant.name}`);
      console.log(`  ID: ${tenant.id}`);
      console.log(`  Schema: ${tenant.schema_name}`);
      console.log(`  Status: ${tenant.status}`);

      // Get admin users for this tenant
      const adminsResult = await pool.query(
        `
          SELECT id, email, role, status, is_verified, tenant_id
          FROM shared.users 
          WHERE tenant_id = $1 AND role = 'admin'
          ORDER BY email
        `,
        [tenant.id]
      );

      // Also check if there are any admin users that should belong to this tenant
      const allAdminsResult = await pool.query(
        `
          SELECT id, email, role, status, is_verified, tenant_id
          FROM shared.users 
          WHERE role = 'admin'
          ORDER BY email
        `
      );
      console.log(`  All admins in system (${allAdminsResult.rowCount}):`);
      for (const admin of allAdminsResult.rows) {
        if (admin.tenant_id === tenant.id) {
          console.log(`    ✓ ${admin.email} (belongs to this tenant)`);
        } else {
          console.log(`    - ${admin.email} (tenant_id: ${admin.tenant_id})`);
        }
      }

      console.log(`  Admins (${adminsResult.rowCount}):`);
      for (const admin of adminsResult.rows) {
        console.log(
          `    - ${admin.email} (status: ${admin.status}, verified: ${admin.is_verified})`
        );
      }

      // Get school info from tenant schema
      await withTenantSearchPath(pool, tenant.schema_name, async (client) => {
        const schoolResult = await client.query(`SELECT id, name FROM schools LIMIT 1`);
        if ((schoolResult.rowCount ?? 0) > 0) {
          console.log(`  School: ${schoolResult.rows[0].name}`);
        } else {
          console.log(`  School: NOT FOUND in schema`);
        }

        // Count users by role
        const usersByRole = await pool.query(
          `
            SELECT role, COUNT(*) as count 
            FROM shared.users 
            WHERE tenant_id = $1 
            GROUP BY role
          `,
          [tenant.id]
        );
        console.log(`  Users by role:`);
        for (const row of usersByRole.rows) {
          console.log(`    - ${row.role}: ${row.count}`);
        }
      });

      console.log('');
    }

    // Verify all school admins from seed data
    const expectedAdmins = [
      'fatou.jallow@newhorizon.edu.gm',
      'lamin.sowe@stpeterslamin.edu.gm',
      'musu.bah@daddyjobe.edu.gm'
    ];

    console.log('\n[verify] Verifying expected admin accounts:\n');
    for (const adminEmail of expectedAdmins) {
      const adminResult = await pool.query(
        `SELECT id, email, tenant_id, role, status, is_verified FROM shared.users WHERE email = $1`,
        [adminEmail.toLowerCase()]
      );
      if ((adminResult.rowCount ?? 0) > 0) {
        const admin = adminResult.rows[0];
        console.log(`✓ ${adminEmail}`);
        console.log(
          `  Status: ${admin.status}, Verified: ${admin.is_verified}, Tenant: ${admin.tenant_id}`
        );
      } else {
        console.log(`✗ ${adminEmail} - NOT FOUND`);
      }
    }

    console.log('\n[verify] Verification complete.\n');
  } catch (error) {
    console.error('[verify] Error:', error);
    throw error;
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  verifyAllSchools()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('[verify] Failed:', error);
      process.exit(1);
    });
}

export { verifyAllSchools };
