import 'dotenv/config';
import { getPool, closePool } from '../db/connection';
import { withTenantSearchPath } from '../db/tenantManager';

async function cleanupEmptyAssignments() {
  const pool = getPool();

  console.log('[cleanup] Removing teacher assignments to classes with no students...\n');

  // Get all tenants
  const tenants = await pool.query(`
    SELECT id, name, schema_name FROM shared.tenants
    WHERE schema_name NOT LIKE 'tenant_alpha' AND schema_name != 'tenant_demo_academy'
    ORDER BY name
  `);

  for (const tenant of tenants.rows) {
    console.log(`\n[cleanup] Processing ${tenant.name}:`);

    await withTenantSearchPath(pool, tenant.schema_name, async (client) => {
      // Find assignments to classes with no students
      const emptyAssignments = await client.query(`
        SELECT 
          ta.id,
          ta.teacher_id,
          ta.class_id,
          c.name as class_name,
          t.name as teacher_name,
          COUNT(DISTINCT s.id) as student_count
        FROM teacher_assignments ta
        JOIN classes c ON c.id = ta.class_id
        JOIN teachers t ON t.id = ta.teacher_id
        LEFT JOIN students s ON s.class_uuid = ta.class_id
        GROUP BY ta.id, ta.teacher_id, ta.class_id, c.name, t.name
        HAVING COUNT(DISTINCT s.id) = 0
          AND (c.name NOT LIKE '% %' OR c.name NOT LIKE '%A' AND c.name NOT LIKE '%B' AND c.name NOT LIKE '%C')
      `);

      const emptyCount = emptyAssignments.rowCount ?? 0;
      if (emptyCount > 0) {
        console.log(`  Found ${emptyCount} assignments to empty classes`);

        for (const assignment of emptyAssignments.rows) {
          // Only delete if it's a generic class (not sectioned)
          const isGenericClass =
            !assignment.class_name.includes('Science A') &&
            !assignment.class_name.includes('Science B') &&
            !assignment.class_name.includes('Science C') &&
            !assignment.class_name.includes('Commerce A') &&
            !assignment.class_name.includes('Commerce B') &&
            !assignment.class_name.includes('Commerce C') &&
            !assignment.class_name.includes('Arts A') &&
            !assignment.class_name.includes('Arts B') &&
            !assignment.class_name.includes('Arts C');

          if (isGenericClass) {
            await client.query(`DELETE FROM teacher_assignments WHERE id = $1`, [assignment.id]);
            console.log(
              `    ✅ Removed assignment: ${assignment.teacher_name} -> ${assignment.class_name}`
            );
          }
        }
      } else {
        console.log(`  No empty assignments found`);
      }
    });
  }

  console.log('\n[cleanup] Cleanup complete.');
}

async function main() {
  try {
    await cleanupEmptyAssignments();
  } catch (error) {
    console.error('[cleanup] Error during cleanup:', error);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

main().catch((error) => {
  console.error('[cleanup] Unexpected failure', error);
  process.exit(1);
});
