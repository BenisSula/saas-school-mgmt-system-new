import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { getPool, closePool } from '../db/connection';

const EXPORT_DIR = path.resolve(__dirname, '../../exports/credentials');
const CREDENTIALS_FILE = path.join(EXPORT_DIR, 'user_credentials.txt');

// Password mappings from seed data
const PASSWORD_MAP = new Map<string, string>([
  // Superuser
  ['owner@saas-platform.system', 'SuperOwner#2025!'],

  // Admins
  ['fatou.jallow@newhorizon.edu.gm', 'NhsAdmin@2025'],
  ['lamin.sowe@stpeterslamin.edu.gm', 'StpAdmin@2025'],
  ['musu.bah@daddyjobe.edu.gm', 'DjcAdmin@2025'],

  // HODs
  ['alhaji.saine@newhorizon.edu.gm', 'NhsScienceHOD@2025'],
  ['mariama.camara@newhorizon.edu.gm', 'NhsCommerceHOD@2025'],
  ['joseph.ceesay@newhorizon.edu.gm', 'NhsArtsHOD@2025'],
  ['hassan.njie@stpeterslamin.edu.gm', 'StpScienceHOD@2025'],
  ['abdoulie.touray@stpeterslamin.edu.gm', 'StpCommerceHOD@2025'],
  ['ebrima.sanyang@stpeterslamin.edu.gm', 'StpArtsHOD@2025'],
  ['momodou.bojang@daddyjobe.edu.gm', 'DjcScienceHOD@2025'],
  ['isatou.jatta@daddyjobe.edu.gm', 'DjcCommerceHOD@2025'],
  ['ousman.darboe@daddyjobe.edu.gm', 'DjcArtsHOD@2025'],

  // Teachers
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

async function exportCredentials() {
  const pool = getPool();

  await fs.mkdir(EXPORT_DIR, { recursive: true });

  const output: string[] = [];
  output.push('='.repeat(100));
  output.push('ALL USER CREDENTIALS - SCHOOL MANAGEMENT SYSTEM');
  output.push('='.repeat(100));
  output.push(`Generated: ${new Date().toISOString()}`);
  output.push('');

  // Get all users with roles
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

  // Group by role
  const superusers = users.rows.filter((u) => u.role === 'superadmin');
  const admins = users.rows.filter((u) => u.role === 'admin');
  const teachers = users.rows.filter((u) => u.role === 'teacher');
  const students = users.rows.filter((u) => u.role === 'student');

  // Superusers
  output.push('\n📌 SUPERUSERS:');
  output.push('-'.repeat(100));
  for (const user of superusers) {
    const email = user.email.toLowerCase();
    const password = PASSWORD_MAP.get(email) ?? 'Password not in seed data';
    const additionalRoles =
      (user.additional_roles as string[])?.filter((r) => r !== 'superadmin') ?? [];
    output.push(`  Name: ${user.full_name ?? 'N/A'}`);
    output.push(`  Email: ${email}`);
    output.push(`  Username: ${user.username ?? 'N/A'}`);
    output.push(`  Password: ${password}`);
    output.push(
      `  Status: ${user.status ?? 'active'}, Verified: ${user.is_verified ? 'Yes' : 'No'}`
    );
    if (additionalRoles.length > 0) {
      output.push(`  Additional Roles: ${additionalRoles.join(', ')}`);
    }
    output.push('');
  }

  // Admins
  output.push('\n👑 ADMINS:');
  output.push('-'.repeat(100));
  for (const user of admins) {
    const email = user.email.toLowerCase();
    const password = PASSWORD_MAP.get(email) ?? 'Password not in seed data';
    const additionalRoles = (user.additional_roles as string[])?.filter((r) => r !== 'admin') ?? [];
    output.push(`  Name: ${user.full_name ?? 'N/A'}`);
    output.push(`  Email: ${email}`);
    output.push(`  Username: ${user.username ?? 'N/A'}`);
    output.push(`  Password: ${password}`);
    output.push(`  School: ${user.school_name ?? 'N/A'}`);
    output.push(
      `  Status: ${user.status ?? 'active'}, Verified: ${user.is_verified ? 'Yes' : 'No'}`
    );
    if (additionalRoles.length > 0) {
      output.push(`  Additional Roles: ${additionalRoles.join(', ')}`);
    }
    output.push('');
  }

  // HODs
  output.push('\n🎓 HEADS OF DEPARTMENT (HODs):');
  output.push('-'.repeat(100));
  const hods = teachers.filter((user) => {
    const additionalRoles = (user.additional_roles as string[]) ?? [];
    return additionalRoles.includes('hod');
  });

  for (const user of hods) {
    const email = user.email.toLowerCase();
    const password = PASSWORD_MAP.get(email) ?? 'Password not in seed data';
    output.push(`  Name: ${user.full_name ?? 'N/A'}`);
    output.push(`  Email: ${email}`);
    output.push(`  Username: ${user.username ?? 'N/A'}`);
    output.push(`  Password: ${password}`);
    output.push(`  School: ${user.school_name ?? 'N/A'}`);
    output.push(`  Department: ${user.department_name ?? 'N/A'}`);
    output.push(
      `  Status: ${user.status ?? 'active'}, Verified: ${user.is_verified ? 'Yes' : 'No'}`
    );
    output.push('');
  }

  // Regular Teachers
  output.push('\n👨‍🏫 TEACHERS:');
  output.push('-'.repeat(100));
  const regularTeachers = teachers.filter((user) => {
    const additionalRoles = (user.additional_roles as string[]) ?? [];
    return !additionalRoles.includes('hod');
  });

  for (const user of regularTeachers) {
    const email = user.email.toLowerCase();
    const password = PASSWORD_MAP.get(email) ?? 'Password not in seed data';
    output.push(`  Name: ${user.full_name ?? 'N/A'}`);
    output.push(`  Email: ${email}`);
    output.push(`  Username: ${user.username ?? 'N/A'}`);
    output.push(`  Password: ${password}`);
    output.push(`  School: ${user.school_name ?? 'N/A'}`);
    output.push(`  Department: ${user.department_name ?? 'N/A'}`);
    output.push(
      `  Status: ${user.status ?? 'active'}, Verified: ${user.is_verified ? 'Yes' : 'No'}`
    );
    output.push('');
  }

  // Students summary
  output.push('\n👨‍🎓 STUDENTS:');
  output.push('-'.repeat(100));
  output.push(`  Total students: ${students.length}`);
  output.push(
    '  Note: Student passwords are generated during seed and follow pattern: Stu[First2Letters][Random4Digits]@2025'
  );
  output.push('  Example: StuAB1234@2025');
  output.push('');
  output.push('  Sample students (first 20):');
  for (const user of students.slice(0, 20)) {
    output.push(
      `    - ${user.full_name ?? 'N/A'} (${user.email.toLowerCase()}) - ${user.school_name ?? 'N/A'}`
    );
  }

  output.push('');
  output.push('='.repeat(100));
  output.push('END OF CREDENTIALS LIST');
  output.push('='.repeat(100));

  await fs.writeFile(CREDENTIALS_FILE, output.join('\n'), 'utf-8');

  console.log('\n[export] Credentials exported successfully!');
  console.log(`[export] File location: ${CREDENTIALS_FILE}`);
  console.log(`[export] Total users: ${users.rowCount}`);
  console.log(`  - Superusers: ${superusers.length}`);
  console.log(`  - Admins: ${admins.length}`);
  console.log(`  - HODs: ${hods.length}`);
  console.log(`  - Teachers: ${regularTeachers.length}`);
  console.log(`  - Students: ${students.length}`);

  // Also print to console
  console.log('\n' + output.join('\n'));
}

async function main() {
  try {
    await exportCredentials();
  } catch (error) {
    console.error('[export] Error exporting credentials:', error);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

main().catch((error) => {
  console.error('[export] Unexpected failure', error);
  process.exit(1);
});
