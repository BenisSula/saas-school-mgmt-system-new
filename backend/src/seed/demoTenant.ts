import argon2 from 'argon2';
import crypto from 'crypto';
import type { Pool } from 'pg';
import { createTenant, withTenantSearchPath } from '../db/tenantManager';

const DEMO_SCHEMA = process.env.DEMO_TENANT_SCHEMA ?? 'tenant_demo_academy';
const DEMO_SCHOOL_NAME = process.env.DEMO_SCHOOL_NAME ?? 'Demo Academy';

const ADMIN_USER = {
  email: process.env.DEMO_ADMIN_EMAIL ?? 'admin.demo@academy.test',
  password: process.env.DEMO_ADMIN_PASSWORD ?? 'AdminDemo#2025',
  role: 'admin' as const
};

const TEACHER_USER = {
  email: process.env.DEMO_TEACHER_EMAIL ?? 'teacher.demo@academy.test',
  password: process.env.DEMO_TEACHER_PASSWORD ?? 'TeacherDemo#2025',
  role: 'teacher' as const,
  name: process.env.DEMO_TEACHER_NAME ?? 'Aisha Bello'
};

const SUPERUSER = {
  email: process.env.DEMO_SUPER_EMAIL ?? 'owner.demo@platform.test',
  password: process.env.DEMO_SUPER_PASSWORD ?? 'OwnerDemo#2025',
  role: 'superadmin' as const
};

const STUDENT_USER = {
  email: process.env.DEMO_STUDENT_EMAIL ?? 'student.demo@academy.test',
  password: process.env.DEMO_STUDENT_PASSWORD ?? 'StudentDemo#2025',
  role: 'student' as const,
  name: process.env.DEMO_STUDENT_NAME ?? 'Tolu Adeyemi'
};

async function ensureTenant(pool: Pool): Promise<{ id: string }> {
  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM shared.tenants WHERE schema_name = $1`,
    [DEMO_SCHEMA]
  );

  if ((existing.rowCount ?? 0) > 0) {
    return { id: existing.rows[0].id };
  }

  return createTenant(
    {
      name: DEMO_SCHOOL_NAME,
      schemaName: DEMO_SCHEMA,
      subscriptionType: 'trial',
      status: 'active',
      billingEmail: ADMIN_USER.email
    },
    pool
  );
}

async function ensureUser(
  pool: Pool,
  {
    email,
    password,
    role,
    preferredId
  }: {
    email: string;
    password: string;
    role: 'admin' | 'teacher' | 'superadmin' | 'student';
    preferredId?: string;
  },
  tenantId: string | null
): Promise<string> {
  const normalisedEmail = email.toLowerCase();
  const passwordHash = await argon2.hash(password);

  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM shared.users WHERE email = $1`,
    [normalisedEmail]
  );

  if ((existing.rowCount ?? 0) > 0) {
    const userId = existing.rows[0].id;
    await pool.query(
      `
        UPDATE shared.users
        SET password_hash = $1,
            role = $2,
            tenant_id = $3,
            is_verified = TRUE
        WHERE id = $4
      `,
      [passwordHash, role, tenantId, userId]
    );
    return userId;
  }

  const userId = preferredId ?? crypto.randomUUID();
  await pool.query(
    `
      INSERT INTO shared.users (id, email, password_hash, role, tenant_id, is_verified)
      VALUES ($1, $2, $3, $4, $5, TRUE)
    `,
    [userId, normalisedEmail, passwordHash, role, tenantId]
  );
  return userId;
}

async function seedTenantData(
  pool: Pool,
  teacherUserId: string,
  studentSeedId: string
): Promise<string> {
  let primaryStudentId = studentSeedId;

  await withTenantSearchPath(pool, DEMO_SCHEMA, async (client) => {
    await client.query('BEGIN');
    try {
      const schoolResult = await client.query<{ id: string }>(
        `SELECT id FROM schools WHERE name = $1`,
        [DEMO_SCHOOL_NAME]
      );

      if (schoolResult.rowCount === 0) {
        await client.query(
          `
            INSERT INTO schools (id, name, address)
            VALUES ($1, $2, $3)
          `,
          [
            crypto.randomUUID(),
            DEMO_SCHOOL_NAME,
            JSON.stringify({ city: 'Demo City', country: 'NG' })
          ]
        );
      }

      const teacherResult = await client.query<{ id: string }>(
        `
          INSERT INTO teachers (id, name, email, subjects, assigned_classes)
          VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
          ON CONFLICT (email) DO UPDATE
            SET name = EXCLUDED.name,
                subjects = EXCLUDED.subjects,
                assigned_classes = EXCLUDED.assigned_classes,
                updated_at = NOW()
          RETURNING id
        `,
        [
          teacherUserId,
          TEACHER_USER.name,
          TEACHER_USER.email,
          JSON.stringify(['Mathematics', 'Science']),
          JSON.stringify(['Grade 8 Emerald'])
        ]
      );
      const teacherId = teacherResult.rows[0].id;

      const classResult = await client.query<{ id: string }>(
        `
          INSERT INTO classes (id, name, description)
          VALUES ($1, $2, $3)
          ON CONFLICT (name) DO UPDATE
            SET description = EXCLUDED.description,
                updated_at = NOW()
          RETURNING id
        `,
        [crypto.randomUUID(), 'Grade 8 Emerald', 'Demo class seeded for showcase']
      );
      const classId = classResult.rows[0].id;

      let subjectId: string;
      const existingSubject = await client.query<{ id: string }>(
        `SELECT id FROM subjects WHERE LOWER(name) = LOWER($1)`,
        ['Mathematics']
      );
      if ((existingSubject.rowCount ?? 0) > 0) {
        subjectId = existingSubject.rows[0]!.id;
        await client.query(
          `
            UPDATE subjects
            SET code = $2,
                updated_at = NOW()
            WHERE id = $1
          `,
          [subjectId, 'MATH-EM8']
        );
      } else {
        const subjectInsert = await client.query<{ id: string }>(
          `
            INSERT INTO subjects (id, name, code)
            VALUES ($1, $2, $3)
            RETURNING id
          `,
          [crypto.randomUUID(), 'Mathematics', 'MATH-EM8']
        );
        subjectId = subjectInsert.rows[0].id;
      }

      await client.query(
        `
          INSERT INTO class_subjects (id, class_id, subject_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (class_id, subject_id) DO NOTHING
        `,
        [crypto.randomUUID(), classId, subjectId]
      );

      await client.query(
        `
          INSERT INTO teacher_assignments (id, teacher_id, class_id, subject_id, is_class_teacher, metadata)
          VALUES ($1, $2, $3, $4, TRUE, $5::jsonb)
          ON CONFLICT (teacher_id, class_id, subject_id) DO UPDATE
            SET is_class_teacher = TRUE,
                metadata = EXCLUDED.metadata,
                updated_at = NOW()
        `,
        [
          crypto.randomUUID(),
          teacherId,
          classId,
          subjectId,
          JSON.stringify({ seeded: 'demo', dropRequested: false })
        ]
      );

      const studentNameParts = STUDENT_USER.name.trim().split(/\s+/);
      const primaryFirstName = studentNameParts[0] ?? 'Tolu';
      const primaryLastName =
        studentNameParts.length > 1 ? studentNameParts.slice(1).join(' ') : 'Adeyemi';

      const studentSeed = [
        { id: studentSeedId, admission: 'DEM-001', first: primaryFirstName, last: primaryLastName },
        { id: crypto.randomUUID(), admission: 'DEM-002', first: 'Chidera', last: 'Okafor' },
        { id: crypto.randomUUID(), admission: 'DEM-003', first: 'Zara', last: 'Mensah' }
      ];

      const studentIds: string[] = [];
      for (const student of studentSeed) {
        const existingStudent = await client.query<{ id: string }>(
          `SELECT id FROM students WHERE admission_number = $1`,
          [student.admission]
        );
        if ((existingStudent.rowCount ?? 0) > 0) {
          const existingId = existingStudent.rows[0]!.id;
          studentIds.push(existingId);
          await client.query(
            `
              UPDATE students
              SET first_name = $1,
                  last_name = $2,
                  class_id = $3,
                  updated_at = NOW()
              WHERE id = $4
            `,
            [student.first, student.last, classId, existingId]
          );
        } else {
          const inserted = await client.query<{ id: string }>(
            `
              INSERT INTO students (id, first_name, last_name, class_id, admission_number, parent_contacts)
              VALUES ($1, $2, $3, $4, $5, $6::jsonb)
              RETURNING id
            `,
            [
              student.id,
              student.first,
              student.last,
              classId,
              student.admission,
              JSON.stringify([
                { type: 'guardian', name: 'Parent/Guardian', phone: '+2348000000000' }
              ])
            ]
          );
          studentIds.push(inserted.rows[0].id);
        }
      }

      if (studentIds.length > 0) {
        primaryStudentId = studentIds[0];
      }

      for (const studentId of studentIds) {
        await client.query(
          `
            INSERT INTO attendance_records (id, student_id, class_id, status, attendance_date)
            VALUES ($1, $2, $3, 'present', CURRENT_DATE - INTERVAL '1 day')
            ON CONFLICT (student_id, class_id, attendance_date) DO NOTHING
          `,
          [crypto.randomUUID(), studentId, classId]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
  return primaryStudentId;
}

export async function seedDemoTenant(pool: Pool): Promise<void> {
  const tenant = await ensureTenant(pool);
  const superUserId = await ensureUser(pool, SUPERUSER, null);
  const adminUserId = await ensureUser(pool, ADMIN_USER, tenant.id);
  const teacherUserId = await ensureUser(pool, TEACHER_USER, tenant.id);
  const studentSeedId = crypto.randomUUID();

  const studentRecordId = await seedTenantData(pool, teacherUserId, studentSeedId);
  const studentUserId = await ensureUser(
    pool,
    { ...STUDENT_USER, preferredId: studentRecordId },
    tenant.id
  );

  if (process.env.NODE_ENV !== 'test') {
    console.log('[seed] Demo tenant ready.', {
      superUser: SUPERUSER.email,
      admin: ADMIN_USER.email,
      teacher: TEACHER_USER.email,
      student: STUDENT_USER.email,
      tenantId: tenant.id,
      userIds: { superUserId, adminUserId, teacherUserId, studentUserId }
    });
  }
}

export type DemoSeedContext = {
  superuserEmail: string;
  superuserPassword: string;
  adminEmail: string;
  adminPassword: string;
  teacherEmail: string;
  teacherPassword: string;
  studentEmail: string;
  studentPassword: string;
  tenantSchema: string;
};

export function getDemoSeedContext(): DemoSeedContext {
  return {
    superuserEmail: SUPERUSER.email,
    superuserPassword: SUPERUSER.password,
    adminEmail: ADMIN_USER.email,
    adminPassword: ADMIN_USER.password,
    teacherEmail: TEACHER_USER.email,
    teacherPassword: TEACHER_USER.password,
    studentEmail: STUDENT_USER.email,
    studentPassword: STUDENT_USER.password,
    tenantSchema: DEMO_SCHEMA
  };
}
