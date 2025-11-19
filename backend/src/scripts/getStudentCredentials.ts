import 'dotenv/config';
import { getPool, closePool } from '../db/connection';

/**
 * Script to retrieve student credentials from database
 * Note: Student passwords follow pattern: Stu[First2Letters][Random4Digits]@2025
 * Since passwords are hashed in DB, we need to check seed summary or regenerate
 */

interface StudentCredential {
  email: string;
  fullName: string;
  school: string;
  passwordPattern: string;
  estimatedPassword: string;
}

async function getStudentCredentials(): Promise<void> {
  const pool = getPool();

  // Get students from different schools
  const students = await pool.query<{
    email: string;
    full_name: string;
    school_name: string;
  }>(`
    SELECT 
      u.email,
      u.full_name,
      t.name as school_name
    FROM shared.users u
    LEFT JOIN shared.tenants t ON t.id = u.tenant_id
    WHERE u.role = 'student'
    ORDER BY t.name, u.email
    LIMIT 10
  `);

  console.log('\n📚 Student Credentials (Password Pattern):\n');
  console.log('='.repeat(100));

  const credentials: StudentCredential[] = [];

  for (const student of students.rows) {
    const fullName = student.full_name || 'Unknown';
    const firstName = fullName.split(' ')[0] || '';
    const firstTwoLetters = firstName.slice(0, 2).toUpperCase();
    const passwordPattern = `Stu${firstTwoLetters}[4digits]@2025`;

    // Since we can't know the exact random 4 digits, we'll show the pattern
    // In practice, you'd need to check the seed summary or reset the password
    const estimatedPassword = `Stu${firstTwoLetters}XXXX@2025`; // XXXX = random 4 digits

    credentials.push({
      email: student.email,
      fullName,
      school: student.school_name || 'Unknown',
      passwordPattern,
      estimatedPassword
    });
  }

  // Group by school
  const bySchool = new Map<string, StudentCredential[]>();
  for (const cred of credentials) {
    if (!bySchool.has(cred.school)) {
      bySchool.set(cred.school, []);
    }
    bySchool.get(cred.school)!.push(cred);
  }

  // Display by school
  for (const [school, schoolStudents] of bySchool.entries()) {
    console.log(`\n🏫 ${school}:`);
    console.log('-'.repeat(100));

    for (const student of schoolStudents.slice(0, 4)) {
      console.log(`\n  Name: ${student.fullName}`);
      console.log(`  Email: ${student.email}`);
      console.log(`  Password Pattern: ${student.passwordPattern}`);
      console.log(
        `  ⚠️  Note: Replace [4digits] with the random 4-digit number generated during seed`
      );
      console.log(`  Estimated Format: ${student.estimatedPassword}`);
    }
  }

  console.log('\n' + '='.repeat(100));
  console.log('\n⚠️  IMPORTANT:');
  console.log('Student passwords are randomly generated during seed execution.');
  console.log('To get exact passwords, you need to:');
  console.log('1. Check the seed summary output (if seed script logged it)');
  console.log('2. Reset passwords using admin panel');
  console.log('3. Re-run seed script and capture the summary output');
  console.log('\nPassword format: Stu[First2Letters][Random4Digits]@2025');
  console.log('Example: Student "Haddy Sowe" → StuHA[random 4 digits]@2025');
}

async function main() {
  try {
    await getStudentCredentials();
  } catch (error) {
    console.error('Error:', error);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

main().catch(console.error);
