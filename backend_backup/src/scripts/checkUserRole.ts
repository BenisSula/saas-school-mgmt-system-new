import 'dotenv/config';
import { getPool, closePool } from '../db/connection';

async function checkUserRole() {
  const pool = getPool();
  try {
    const result = await pool.query(
      `
        SELECT 
          u.id,
          u.email,
          u.role,
          u.tenant_id,
          u.status,
          u.is_verified,
          t.name as tenant_name,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'role', ur.role_name,
                'metadata', ur.metadata
              )
            ) FILTER (WHERE ur.role_name IS NOT NULL),
            '[]'::json
          ) as additional_roles
        FROM shared.users u
        LEFT JOIN shared.tenants t ON u.tenant_id = t.id
        LEFT JOIN shared.user_roles ur ON u.id = ur.user_id
        WHERE u.email IN (
          'fatou.jallow@newhorizon.edu.gm',
          'lamin.sowe@stpeterslamin.edu.gm',
          'musu.bah@daddyjobe.edu.gm'
        )
        GROUP BY u.id, u.email, u.role, u.tenant_id, u.status, u.is_verified, t.name
        ORDER BY u.email
      `
    );

    console.log('\n[check] Admin user details:\n');
    for (const user of result.rows) {
      console.log(`Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Tenant: ${user.tenant_name} (${user.tenant_id})`);
      console.log(`  Status: ${user.status}`);
      console.log(`  Verified: ${user.is_verified}`);
      console.log(`  Additional Roles: ${JSON.stringify(user.additional_roles)}`);
      console.log('');
    }
  } catch (error) {
    console.error('[check] Error:', error);
    throw error;
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  checkUserRole()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('[check] Failed:', error);
      process.exit(1);
    });
}

export { checkUserRole };
