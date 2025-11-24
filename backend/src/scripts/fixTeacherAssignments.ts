import 'dotenv/config';
import { getPool, closePool } from '../db/connection';
import { withTenantSearchPath } from '../db/tenantManager';

async function fixTeacherAssignments() {
  const pool = getPool();

  console.log('[fix] Fixing teacher class assignments to match student classes...\n');

  // Get all tenants
  const tenants = await pool.query(`
    SELECT id, name, schema_name FROM shared.tenants
    WHERE schema_name NOT LIKE 'tenant_alpha' AND schema_name != 'tenant_demo_academy'
    ORDER BY name
  `);

  for (const tenant of tenants.rows) {
    console.log(`\n[fix] Processing ${tenant.name} (${tenant.schema_name}):`);

    await withTenantSearchPath(pool, tenant.schema_name, async (client) => {
      // Get all teacher assignments
      const assignments = await client.query(`
        SELECT 
          ta.id,
          ta.teacher_id,
          ta.class_id as current_class_id,
          ta.subject_id,
          ta.is_class_teacher,
          c.name as current_class_name,
          t.name as teacher_name
        FROM teacher_assignments ta
        JOIN classes c ON c.id = ta.class_id
        JOIN teachers t ON t.id = ta.teacher_id
        ORDER BY t.name, c.name
      `);

      console.log(`  Found ${assignments.rowCount} teacher assignments`);

      let fixedCount = 0;
      let deletedCount = 0;

      for (const assignment of assignments.rows) {
        const currentClassName = assignment.current_class_name;

        // Check if this is a simple class name (like "Grade 10") vs detailed (like "Grade 10 Science A")
        const isSimpleClass =
          !currentClassName.includes('Science') &&
          !currentClassName.includes('Commerce') &&
          !currentClassName.includes('Arts') &&
          !currentClassName.match(/[ABC]$/);

        if (isSimpleClass) {
          // Find all detailed classes that match this grade level
          const gradeMatch = currentClassName.match(/Grade \d+/);
          if (gradeMatch) {
            const gradeLevel = gradeMatch[0];

            // Find classes that start with this grade level and have sections
            const detailedClasses = await client.query(
              `
              SELECT id, name, department_id
              FROM classes
              WHERE name LIKE $1 || '%'
                AND (name LIKE '%Science%' OR name LIKE '%Commerce%' OR name LIKE '%Arts%')
                AND name LIKE '% %'
              ORDER BY name
            `,
              [`${gradeLevel} `]
            );

            const detailedCount = detailedClasses.rowCount ?? 0;
            if (detailedCount > 0) {
              // Delete the old assignment for the simple class
              await client.query(`DELETE FROM teacher_assignments WHERE id = $1`, [assignment.id]);
              deletedCount++;

              // Create new assignments for each detailed class
              for (const detailedClass of detailedClasses.rows) {
                // Check if assignment already exists
                const existing = await client.query(
                  `
                  SELECT id FROM teacher_assignments
                  WHERE teacher_id = $1
                    AND class_id = $2
                    AND subject_id = $3
                `,
                  [assignment.teacher_id, detailedClass.id, assignment.subject_id]
                );

                const existingCount = existing.rowCount ?? 0;
                if (existingCount === 0) {
                  await client.query(
                    `
                    INSERT INTO teacher_assignments (
                      id,
                      teacher_id,
                      class_id,
                      subject_id,
                      is_class_teacher,
                      metadata,
                      created_at,
                      updated_at
                    )
                    VALUES (
                      gen_random_uuid(),
                      $1,
                      $2,
                      $3,
                      $4,
                      $5::jsonb,
                      NOW(),
                      NOW()
                    )
                  `,
                    [
                      assignment.teacher_id,
                      detailedClass.id,
                      assignment.subject_id,
                      assignment.is_class_teacher,
                      JSON.stringify({
                        migrated_from: assignment.current_class_id,
                        original_class: currentClassName,
                        migration_date: new Date().toISOString(),
                      }),
                    ]
                  );
                  fixedCount++;
                  console.log(
                    `    ✅ Created assignment for ${assignment.teacher_name} -> ${detailedClass.name}`
                  );
                }
              }
            } else {
              console.log(`    ⚠️  No detailed classes found for ${currentClassName}`);
            }
          }
        }
      }

      console.log(`  Fixed ${fixedCount} assignments, deleted ${deletedCount} old assignments`);
    });
  }

  console.log('\n[fix] Assignment fixes complete.');
}

async function main() {
  try {
    await fixTeacherAssignments();
  } catch (error) {
    console.error('[fix] Error fixing assignments:', error);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

main().catch((error) => {
  console.error('[fix] Unexpected failure', error);
  process.exit(1);
});
