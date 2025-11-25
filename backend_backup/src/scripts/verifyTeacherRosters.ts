import 'dotenv/config';
import { getPool, closePool } from '../db/connection';
import { withTenantSearchPath } from '../db/tenantManager';
import { getTeacherClassRoster } from '../services/teacherDashboardService';

async function verifyTeacherRosters() {
  const pool = getPool();

  console.log('[verify] Verifying teacher class roster assignments...\n');

  // Get all tenants
  const tenants = await pool.query(`
    SELECT id, name, schema_name FROM shared.tenants
    WHERE schema_name NOT LIKE 'tenant_alpha' AND schema_name != 'tenant_demo_academy'
    ORDER BY name
  `);

  for (const tenant of tenants.rows) {
    console.log(`\n[verify] Checking ${tenant.name} (${tenant.schema_name}):`);

    await withTenantSearchPath(pool, tenant.schema_name, async (client) => {
      // Get all teachers
      const teachers = await client.query(`
        SELECT id, name, email FROM teachers
        ORDER BY name
      `);

      console.log(`  Found ${teachers.rowCount} teachers`);

      // Get all teacher assignments
      const assignments = await client.query(`
        SELECT 
          ta.teacher_id,
          ta.class_id,
          ta.is_class_teacher,
          t.name as teacher_name,
          c.name as class_name,
          COUNT(DISTINCT s.id) as student_count
        FROM teacher_assignments ta
        JOIN teachers t ON t.id = ta.teacher_id
        JOIN classes c ON c.id = ta.class_id
        LEFT JOIN students s ON s.class_uuid = ta.class_id
        GROUP BY ta.teacher_id, ta.class_id, ta.is_class_teacher, t.name, c.name
        ORDER BY t.name, c.name
      `);

      console.log(`  Found ${assignments.rowCount} teacher assignments`);

      // Check each teacher's assignments
      for (const teacher of teachers.rows.slice(0, 5)) {
        // Check first 5 teachers
        const teacherAssignments = assignments.rows.filter((a) => a.teacher_id === teacher.id);

        if (teacherAssignments.length === 0) {
          console.log(`  ⚠️  Teacher ${teacher.name} (${teacher.email}) has no class assignments`);
          continue;
        }

        console.log(
          `  ✅ Teacher ${teacher.name} has ${teacherAssignments.length} class assignment(s):`
        );

        for (const assignment of teacherAssignments) {
          // Try to load the roster
          try {
            const roster = await getTeacherClassRoster(
              client,
              tenant.schema_name,
              teacher.id,
              assignment.class_id
            );

            if (!roster) {
              console.log(
                `    ❌ Cannot load roster for class "${assignment.class_name}" - teacher not assigned`
              );
            } else {
              console.log(
                `    ✅ Class "${assignment.class_name}" (${assignment.is_class_teacher ? 'Class Teacher' : 'Subject Teacher'}): ${roster.length} students in roster`
              );

              // Verify student count matches
              if (roster.length !== Number(assignment.student_count)) {
                console.log(
                  `    ⚠️  Roster count mismatch: roster has ${roster.length} students, but database shows ${assignment.student_count}`
                );
              }
            }
          } catch (error) {
            console.log(
              `    ❌ Error loading roster for class "${assignment.class_name}": ${(error as Error).message}`
            );
          }
        }
      }

      // Check for classes with no teacher assignments
      const unassignedClasses = await client.query(`
        SELECT c.id, c.name, COUNT(DISTINCT s.id) as student_count
        FROM classes c
        LEFT JOIN teacher_assignments ta ON ta.class_id = c.id
        LEFT JOIN students s ON s.class_uuid = c.id
        WHERE ta.id IS NULL
        GROUP BY c.id, c.name
        ORDER BY c.name
      `);

      const unassignedCount = unassignedClasses.rowCount ?? 0;
      if (unassignedCount > 0) {
        console.log(`\n  ⚠️  Found ${unassignedCount} classes with no teacher assignments:`);
        for (const clazz of unassignedClasses.rows.slice(0, 5)) {
          console.log(`    - ${clazz.name} (${clazz.student_count} students)`);
        }
      }

      // Check for students with no class_uuid
      const studentsWithoutClass = await client.query(`
        SELECT COUNT(*) as count
        FROM students
        WHERE class_uuid IS NULL
      `);

      if (Number(studentsWithoutClass.rows[0].count) > 0) {
        console.log(
          `\n  ⚠️  Found ${studentsWithoutClass.rows[0].count} students without class_uuid assignment`
        );
      }
    });
  }

  console.log('\n[verify] Verification complete.');
}

async function main() {
  try {
    await verifyTeacherRosters();
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
