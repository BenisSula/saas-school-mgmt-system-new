import 'dotenv/config';
import { getPool, closePool } from '../db/connection';
import { withTenantSearchPath } from '../db/tenantManager';

async function createSchoolRecord() {
  const pool = getPool();
  const tenantSchema = 'tenant_new_horizon_senior_secondary_school';
  const schoolName = 'New Horizon Senior Secondary School';

  try {
    await withTenantSearchPath(pool, tenantSchema, async (client) => {
      const existing = await client.query(`SELECT id FROM schools WHERE name = $1`, [schoolName]);

      if ((existing.rowCount ?? 0) === 0) {
        await client.query(
          `
            INSERT INTO schools (name, address)
            VALUES ($1, $2::jsonb)
          `,
          [
            schoolName,
            JSON.stringify({
              city: 'Banjul',
              country: 'GM',
              address: 'New Horizon Senior Secondary School, Banjul, The Gambia'
            })
          ]
        );
        console.log(`[seed] Created school record: ${schoolName}`);
      } else {
        console.log(`[seed] School record already exists: ${schoolName}`);
      }
    });
  } catch (error) {
    console.error('[seed] Failed to create school record:', error);
    throw error;
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  createSchoolRecord()
    .then(() => {
      console.log('[seed] School record creation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[seed] School record creation failed:', error);
      process.exit(1);
    });
}

export { createSchoolRecord };
