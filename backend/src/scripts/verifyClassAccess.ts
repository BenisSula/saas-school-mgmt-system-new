import 'dotenv/config';
import { getPool, closePool } from '../db/connection';
import { withTenantSearchPath } from '../db/tenantManager';
import {
  listTeacherAssignmentsRows,
  getTeacherClassRoster,
} from '../services/teacherDashboardService';

async function verifyClassAccess() {
  const pool = getPool();

  console.log('[verify] Verifying teacher access to admin-allocated classes...\n');

  // Get all tenants
  const tenants = await pool.query(`
    SELECT id, name, schema_name FROM shared.tenants
    WHERE schema_name NOT LIKE 'tenant_alpha' AND schema_name != 'tenant_demo_academy'
    ORDER BY name
  `);

  const accessResults: Array<{
    tenant: string;
    teacher: string;
    teacherEmail: string;
    class: string;
    canAccess: boolean;
    studentCount: number;
  }> = [];

  for (const tenant of tenants.rows) {
    console.log(`\n[verify] Checking ${tenant.name} (${tenant.schema_name}):`);

    await withTenantSearchPath(pool, tenant.schema_name, async (client) => {
      // Get all teachers
      const teachers = await client.query(`
        SELECT id, name, email FROM teachers
        ORDER BY name
      `);

      // Get all classes
      const classes = await client.query(`
        SELECT c.id, c.name, COUNT(DISTINCT s.id) as student_count
        FROM classes c
        LEFT JOIN students s ON s.class_uuid = c.id
        GROUP BY c.id, c.name
        HAVING COUNT(DISTINCT s.id) > 0
        ORDER BY c.name
      `);

      console.log(
        `  Found ${teachers.rowCount} teachers and ${classes.rowCount} classes with students`
      );

      // Check each teacher's access to each class
      for (const teacher of teachers.rows) {
        const assignments = await listTeacherAssignmentsRows(
          client,
          tenant.schema_name,
          teacher.id
        );

        const assignedClassIds = new Set(assignments.map((a) => a.classId));

        for (const clazz of classes.rows) {
          const isAssigned = assignedClassIds.has(clazz.id);

          if (isAssigned) {
            // Try to load the roster
            try {
              const roster = await getTeacherClassRoster(
                client,
                tenant.schema_name,
                teacher.id,
                clazz.id
              );

              const canAccess = roster !== null;
              const studentCount = roster?.length ?? 0;

              accessResults.push({
                tenant: tenant.name,
                teacher: teacher.name,
                teacherEmail: teacher.email ?? 'N/A',
                class: clazz.name,
                canAccess,
                studentCount,
              });

              if (canAccess) {
                console.log(
                  `  ✅ ${teacher.name} can access "${clazz.name}" (${studentCount} students)`
                );
              } else {
                console.log(
                  `  ❌ ${teacher.name} cannot access "${clazz.name}" (assignment exists but roster fails)`
                );
              }
            } catch (error) {
              console.log(
                `  ❌ ${teacher.name} cannot access "${clazz.name}": ${(error as Error).message}`
              );
              accessResults.push({
                tenant: tenant.name,
                teacher: teacher.name,
                teacherEmail: teacher.email ?? 'N/A',
                class: clazz.name,
                canAccess: false,
                studentCount: 0,
              });
            }
          }
        }
      }
    });
  }

  // Summary
  const totalChecks = accessResults.length;
  const successfulAccess = accessResults.filter((r) => r.canAccess).length;
  const failedAccess = totalChecks - successfulAccess;

  console.log('\n[verify] Access Summary:');
  console.log(`  Total class access checks: ${totalChecks}`);
  console.log(`  Successful access: ${successfulAccess}`);
  console.log(`  Failed access: ${failedAccess}`);

  if (failedAccess > 0) {
    console.log('\n  Failed access cases:');
    accessResults
      .filter((r) => !r.canAccess)
      .forEach((r) => {
        console.log(`    - ${r.teacher} (${r.teacherEmail}) -> ${r.class}`);
      });
  }

  return accessResults;
}

async function exportAllUserCredentials() {
  const pool = getPool();

  console.log('\n[export] Exporting all user credentials...\n');

  // Get all users with their roles
  const users = await pool.query(`
    SELECT 
      u.id,
      u.email,
      u.username,
      u.full_name,
      u.role,
      u.status,
      u.is_verified,
      u.tenant_id,
      u.school_id,
      u.department_id,
      t.name as tenant_name,
      s.name as school_name,
      d.name as department_name,
      ARRAY_AGG(DISTINCT ur.role_name) FILTER (WHERE ur.role_name IS NOT NULL) as additional_roles
    FROM shared.users u
    LEFT JOIN shared.tenants t ON t.id = u.tenant_id
    LEFT JOIN shared.schools s ON s.id = u.school_id
    LEFT JOIN shared.departments d ON d.id = u.department_id
    LEFT JOIN shared.user_roles ur ON ur.user_id = u.id
    WHERE u.role IN ('superadmin', 'admin', 'teacher', 'student')
    GROUP BY u.id, u.email, u.username, u.full_name, u.role, u.status, u.is_verified, 
             u.tenant_id, u.school_id, u.department_id, t.name, s.name, d.name
    ORDER BY 
      CASE u.role
        WHEN 'superadmin' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'teacher' THEN 3
        WHEN 'student' THEN 4
      END,
      u.email
  `);

  const credentials = new Map<string, string>();

  // Superuser
  const superuserEmail = (
    process.env.SEED_SUPERUSER_EMAIL ?? 'owner@saas-platform.system'
  ).toLowerCase();
  const superuserPassword = process.env.SEED_SUPERUSER_PASSWORD ?? 'SuperOwner#2025!';
  credentials.set(superuserEmail, superuserPassword);

  // Admin passwords
  const adminPasswords = new Map([
    ['fatou.jallow@newhorizon.edu.gm', 'NhsAdmin@2025'],
    ['lamin.sowe@stpeterslamin.edu.gm', 'StpAdmin@2025'],
    ['musu.bah@daddyjobe.edu.gm', 'DjcAdmin@2025'],
  ]);

  // HOD passwords
  const hodPasswords = new Map([
    ['alhaji.saine@newhorizon.edu.gm', 'NhsScienceHOD@2025'],
    ['mariama.camara@newhorizon.edu.gm', 'NhsCommerceHOD@2025'],
    ['joseph.ceesay@newhorizon.edu.gm', 'NhsArtsHOD@2025'],
    ['hassan.njie@stpeterslamin.edu.gm', 'StpScienceHOD@2025'],
    ['abdoulie.touray@stpeterslamin.edu.gm', 'StpCommerceHOD@2025'],
    ['ebrima.sanyang@stpeterslamin.edu.gm', 'StpArtsHOD@2025'],
    ['momodou.bojang@daddyjobe.edu.gm', 'DjcScienceHOD@2025'],
    ['isatou.jatta@daddyjobe.edu.gm', 'DjcCommerceHOD@2025'],
    ['ousman.darboe@daddyjobe.edu.gm', 'DjcArtsHOD@2025'],
  ]);

  // Teacher passwords
  const teacherPasswords = new Map([
    ['pamodou.jagne@newhorizon.edu.gm', 'TeachNHS01@2025'],
    ['jainaba.ceesay@newhorizon.edu.gm', 'TeachNHS02@2025'],
    ['lamin.jammeh@newhorizon.edu.gm', 'TeachNHS03@2025'],
    ['mariama.bah@newhorizon.edu.gm', 'TeachNHS04@2025'],
    ['aisha.touray@newhorizon.edu.gm', 'TeachNHS05@2025'],
    ['modou.colley@newhorizon.edu.gm', 'TeachNHS06@2025'],
    ['fatou.sowe@newhorizon.edu.gm', 'TeachNHS07@2025'],
    ['ebrima.faal@newhorizon.edu.gm', 'TeachNHS08@2025'],
    ['haddy.jatta@newhorizon.edu.gm', 'TeachNHS09@2025'],
    ['omar.ceesay@stpeterslamin.edu.gm', 'TeachSTP01@2025'],
    ['mariama.jawara@stpeterslamin.edu.gm', 'TeachSTP02@2025'],
    ['sainabou.jallow@stpeterslamin.edu.gm', 'TeachSTP03@2025'],
    ['musa.touray@stpeterslamin.edu.gm', 'TeachSTP04@2025'],
    ['binta.bah@stpeterslamin.edu.gm', 'TeachSTP05@2025'],
    ['ousman.ceesay@stpeterslamin.edu.gm', 'TeachSTP06@2025'],
    ['isatou.cham@stpeterslamin.edu.gm', 'TeachSTP07@2025'],
    ['abdoulie.baldeh@stpeterslamin.edu.gm', 'TeachSTP08@2025'],
    ['haddy.sanyang@stpeterslamin.edu.gm', 'TeachSTP09@2025'],
    ['lamin.ceesay@daddyjobe.edu.gm', 'TeachDJC01@2025'],
    ['haddy.jallow@daddyjobe.edu.gm', 'TeachDJC02@2025'],
    ['modou.darboe@daddyjobe.edu.gm', 'TeachDJC03@2025'],
    ['mariam.kinteh@daddyjobe.edu.gm', 'TeachDJC04@2025'],
    ['fatoumata.ceesay@daddyjobe.edu.gm', 'TeachDJC05@2025'],
    ['alieu.sanyang@daddyjobe.edu.gm', 'TeachDJC06@2025'],
    ['jainaba.camara@daddyjobe.edu.gm', 'TeachDJC07@2025'],
    ['lamin.bah@daddyjobe.edu.gm', 'TeachDJC08@2025'],
    ['omar.jallow@daddyjobe.edu.gm', 'TeachDJC09@2025'],
  ]);

  console.log('='.repeat(80));
  console.log('ALL USER CREDENTIALS');
  console.log('='.repeat(80));

  // Group by role
  const byRole = {
    superadmin: [] as typeof users.rows,
    admin: [] as typeof users.rows,
    teacher: [] as typeof users.rows,
    student: [] as typeof users.rows,
  };

  for (const user of users.rows) {
    const role = user.role as keyof typeof byRole;
    if (byRole[role]) {
      byRole[role].push(user);
    }
  }

  // Superuser
  console.log('\n📌 SUPERUSER:');
  console.log('-'.repeat(80));
  for (const user of byRole.superadmin) {
    const email = user.email.toLowerCase();
    const password = credentials.get(email) ?? 'Password not in seed data';
    const additionalRoles =
      (user.additional_roles as string[])?.filter((r) => r !== 'superadmin') ?? [];
    console.log(`  Name: ${user.full_name ?? 'N/A'}`);
    console.log(`  Email: ${email}`);
    console.log(`  Username: ${user.username ?? 'N/A'}`);
    console.log(`  Password: ${password}`);
    console.log(
      `  Status: ${user.status ?? 'active'}, Verified: ${user.is_verified ? 'Yes' : 'No'}`
    );
    if (additionalRoles.length > 0) {
      console.log(`  Additional Roles: ${additionalRoles.join(', ')}`);
    }
    console.log('');
  }

  // Admins
  console.log('\n👑 ADMINS:');
  console.log('-'.repeat(80));
  for (const user of byRole.admin) {
    const email = user.email.toLowerCase();
    const password = adminPasswords.get(email) ?? 'Password not in seed data';
    const additionalRoles = (user.additional_roles as string[])?.filter((r) => r !== 'admin') ?? [];
    console.log(`  Name: ${user.full_name ?? 'N/A'}`);
    console.log(`  Email: ${email}`);
    console.log(`  Username: ${user.username ?? 'N/A'}`);
    console.log(`  Password: ${password}`);
    console.log(`  School: ${user.school_name ?? 'N/A'}`);
    console.log(
      `  Status: ${user.status ?? 'active'}, Verified: ${user.is_verified ? 'Yes' : 'No'}`
    );
    if (additionalRoles.length > 0) {
      console.log(`  Additional Roles: ${additionalRoles.join(', ')}`);
    }
    console.log('');
  }

  // HODs (teachers with HOD role)
  console.log('\n🎓 HEADS OF DEPARTMENT (HODs):');
  console.log('-'.repeat(80));
  const hods = byRole.teacher.filter((user) => {
    const additionalRoles = (user.additional_roles as string[]) ?? [];
    return additionalRoles.includes('hod');
  });

  for (const user of hods) {
    const email = user.email.toLowerCase();
    const password =
      hodPasswords.get(email) ?? teacherPasswords.get(email) ?? 'Password not in seed data';
    console.log(`  Name: ${user.full_name ?? 'N/A'}`);
    console.log(`  Email: ${email}`);
    console.log(`  Username: ${user.username ?? 'N/A'}`);
    console.log(`  Password: ${password}`);
    console.log(`  School: ${user.school_name ?? 'N/A'}`);
    console.log(`  Department: ${user.department_name ?? 'N/A'}`);
    console.log(
      `  Status: ${user.status ?? 'active'}, Verified: ${user.is_verified ? 'Yes' : 'No'}`
    );
    console.log('');
  }

  // Teachers (excluding HODs)
  console.log('\n👨‍🏫 TEACHERS:');
  console.log('-'.repeat(80));
  const regularTeachers = byRole.teacher.filter((user) => {
    const additionalRoles = (user.additional_roles as string[]) ?? [];
    return !additionalRoles.includes('hod');
  });

  for (const user of regularTeachers) {
    const email = user.email.toLowerCase();
    const password = teacherPasswords.get(email) ?? 'Password not in seed data';
    console.log(`  Name: ${user.full_name ?? 'N/A'}`);
    console.log(`  Email: ${email}`);
    console.log(`  Username: ${user.username ?? 'N/A'}`);
    console.log(`  Password: ${password}`);
    console.log(`  School: ${user.school_name ?? 'N/A'}`);
    console.log(`  Department: ${user.department_name ?? 'N/A'}`);
    console.log(
      `  Status: ${user.status ?? 'active'}, Verified: ${user.is_verified ? 'Yes' : 'No'}`
    );
    console.log('');
  }

  // Students (sample - too many to list all)
  console.log('\n👨‍🎓 STUDENTS (Sample - first 10):');
  console.log('-'.repeat(80));
  console.log(`  Total students in database: ${byRole.student.length}`);
  console.log('  Note: Student passwords are generated and not stored in plaintext.');
  console.log(
    '  To get student credentials, check the seed script output or export credentials script.'
  );
  console.log('');

  for (const user of byRole.student.slice(0, 10)) {
    console.log(`  Name: ${user.full_name ?? 'N/A'}`);
    console.log(`  Email: ${user.email.toLowerCase()}`);
    console.log(`  Username: ${user.username ?? 'N/A'}`);
    console.log(`  School: ${user.school_name ?? 'N/A'}`);
    console.log(
      `  Status: ${user.status ?? 'active'}, Verified: ${user.is_verified ? 'Yes' : 'No'}`
    );
    console.log('');
  }

  console.log('='.repeat(80));
}

async function main() {
  try {
    const accessResults = await verifyClassAccess();
    await exportAllUserCredentials();

    // Final summary
    console.log('\n[verify] Final Summary:');
    const allCanAccess = accessResults.every((r) => r.canAccess);
    if (allCanAccess) {
      console.log('  ✅ All teachers can access their assigned classes!');
    } else {
      console.log('  ⚠️  Some teachers cannot access their assigned classes. See details above.');
    }
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
