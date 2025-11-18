import crypto from 'crypto';
import type { Pool } from 'pg';
import { createTestPool } from './utils/testDb';
import { getPool } from '../src/db/connection';
import { markAttendance } from '../src/services/attendanceService';
import { bulkUpsertGrades } from '../src/services/examService';

jest.mock('../src/db/connection', () => ({
  getPool: jest.fn(),
  closePool: jest.fn()
}));

const mockedGetPool = jest.mocked(getPool);

describe('Service-level Teacher Assignment Checks', () => {
  let pool: Pool;
  let tenantId: string;
  let teacherUserId: string;
  let teacherId: string;
  let otherTeacherId: string;
  let classId: string;
  let otherClassId: string;
  let subjectId: string;
  let studentId: string;
  let examId: string;

  beforeAll(async () => {
    const testPool = await createTestPool();
    pool = testPool.pool;
    mockedGetPool.mockReturnValue(pool);
    tenantId = crypto.randomUUID();
    teacherUserId = crypto.randomUUID();
    teacherId = crypto.randomUUID();
    otherTeacherId = crypto.randomUUID();
    classId = crypto.randomUUID();
    otherClassId = crypto.randomUUID();
    subjectId = crypto.randomUUID();
    studentId = crypto.randomUUID();
    examId = crypto.randomUUID();

    // Create tenant schema
    await pool.query(`CREATE SCHEMA IF NOT EXISTS tenant_test`);

    // Create tenant record
    await pool.query(
      `
        INSERT INTO shared.tenants (id, name, schema_name)
        VALUES ($1, 'Test School', 'tenant_test')
        ON CONFLICT (schema_name) DO NOTHING
      `,
      [tenantId]
    );

    // Create teacher users
    await pool.query(
      `
        INSERT INTO shared.users (id, email, password_hash, role, tenant_id, is_verified, status)
        VALUES 
          ($1, 'teacher@test.com', 'hash', 'teacher', $3, true, 'active'),
          ($2, 'otherteacher@test.com', 'hash', 'teacher', $3, true, 'active')
        ON CONFLICT (email) DO UPDATE SET id = EXCLUDED.id
      `,
      [teacherUserId, crypto.randomUUID(), tenantId]
    );

    // Create teachers table
    await pool.query(
      `
        CREATE TABLE IF NOT EXISTS tenant_test.teachers (
          id UUID PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          subjects JSONB DEFAULT '[]'::jsonb,
          assigned_classes JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `
    );

    await pool.query(
      `
        INSERT INTO tenant_test.teachers (id, name, email)
        VALUES ($1, 'Test Teacher', 'teacher@test.com'), ($2, 'Other Teacher', 'otherteacher@test.com')
        ON CONFLICT (email) DO UPDATE SET id = EXCLUDED.id
      `,
      [teacherId, otherTeacherId]
    );

    // Create classes
    await pool.query(
      `
        CREATE TABLE IF NOT EXISTS tenant_test.classes (
          id UUID PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `
    );

    await pool.query(
      `
        INSERT INTO tenant_test.classes (id, name, description)
        VALUES ($1, 'Class A', 'Assigned class'), ($2, 'Class B', 'Not assigned class')
      `,
      [classId, otherClassId]
    );

    // Create subjects
    await pool.query(
      `
        CREATE TABLE IF NOT EXISTS tenant_test.subjects (
          id UUID PRIMARY KEY,
          name TEXT NOT NULL,
          code TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `
    );

    await pool.query(
      `
        INSERT INTO tenant_test.subjects (id, name, code)
        VALUES ($1, 'Mathematics', 'MATH')
      `,
      [subjectId]
    );

    // Create teacher_assignments table
    await pool.query(
      `
        CREATE TABLE IF NOT EXISTS tenant_test.teacher_assignments (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          teacher_id UUID NOT NULL,
          class_id UUID NOT NULL,
          subject_id UUID NOT NULL,
          is_class_teacher BOOLEAN NOT NULL DEFAULT FALSE,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (teacher_id, class_id, subject_id)
        )
      `
    );

    // Create assignment: teacher assigned to Class A
    await pool.query(
      `
        INSERT INTO tenant_test.teacher_assignments (teacher_id, class_id, subject_id, is_class_teacher)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (teacher_id, class_id, subject_id) DO NOTHING
      `,
      [teacherId, classId, subjectId]
    );

    // Create attendance_records table
    await pool.query(
      `
        CREATE TABLE IF NOT EXISTS tenant_test.attendance_records (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          student_id UUID,
          class_id TEXT,
          status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')),
          marked_by UUID,
          attendance_date DATE NOT NULL,
          metadata JSONB DEFAULT '{}'::jsonb,
          recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (student_id, class_id, attendance_date)
        )
      `
    );

    // Create students table
    await pool.query(
      `
        CREATE TABLE IF NOT EXISTS tenant_test.students (
          id UUID PRIMARY KEY,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          admission_number TEXT UNIQUE,
          class_id TEXT,
          class_uuid UUID,
          parent_contacts JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `
    );

    await pool.query(
      `
        INSERT INTO tenant_test.students (id, first_name, last_name, class_uuid)
        VALUES ($1, 'Test', 'Student', $2)
      `,
      [studentId, classId]
    );

    // Create exams and grades tables
    await pool.query(
      `
        CREATE TABLE IF NOT EXISTS tenant_test.exams (
          id UUID PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          exam_date DATE,
          metadata JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `
    );

    await pool.query(
      `
        INSERT INTO tenant_test.exams (id, name)
        VALUES ($1, 'Test Exam')
      `,
      [examId]
    );

    await pool.query(
      `
        CREATE TABLE IF NOT EXISTS tenant_test.grades (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          student_id UUID NOT NULL,
          exam_id UUID NOT NULL,
          subject TEXT NOT NULL,
          score DOUBLE PRECISION NOT NULL,
          grade TEXT,
          remarks TEXT,
          recorded_by UUID,
          class_id UUID,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (student_id, exam_id, subject)
        )
      `
    );

    await pool.query(
      `
        CREATE TABLE IF NOT EXISTS tenant_test.grade_scales (
          min_score DOUBLE PRECISION NOT NULL,
          max_score DOUBLE PRECISION NOT NULL,
          grade TEXT NOT NULL,
          remark TEXT
        )
      `
    );

    await pool.query(
      `
        INSERT INTO tenant_test.grade_scales (min_score, max_score, grade, remark)
        VALUES (90, 100, 'A', 'Excellent'), (80, 89, 'B', 'Good'), (70, 79, 'C', 'Average')
      `
    );
  });

  describe('attendanceService.markAttendance', () => {
    beforeEach(async () => {
      // Clean up attendance records between tests to avoid UUID conflicts in pg-mem
      await pool.query(`DELETE FROM tenant_test.attendance_records`);
    });

    it('allows teacher to mark attendance for assigned class', async () => {
      const client = await pool.connect();
      try {
        // Use a unique date to avoid conflicts
        const uniqueDate = `2025-01-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`;
        await expect(
          markAttendance(
            client,
            'tenant_test',
            [
              {
                studentId,
                classId: classId,
                status: 'present',
                markedBy: teacherUserId,
                date: uniqueDate
              }
            ],
            teacherUserId
          )
        ).resolves.not.toThrow();
      } finally {
        client.release();
      }
    });

    it('rejects teacher from marking attendance for non-assigned class', async () => {
      const client = await pool.connect();
      try {
        // Use a unique date to avoid conflicts
        const uniqueDate = `2025-01-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`;
        await expect(
          markAttendance(
            client,
            'tenant_test',
            [
              {
                studentId,
                classId: otherClassId, // Not assigned
                status: 'present',
                markedBy: teacherUserId,
                date: uniqueDate
              }
            ],
            teacherUserId
          )
        ).rejects.toThrow('Teacher is not assigned to this class');
      } finally {
        client.release();
      }
    });

    it('allows admin to mark attendance for any class', async () => {
      const adminUserId = crypto.randomUUID();
      const differentStudentId = crypto.randomUUID();
      await pool.query(
        `
          INSERT INTO shared.users (id, email, password_hash, role, tenant_id, is_verified, status)
          VALUES ($1, 'admin@test.com', 'hash', 'admin', $2, true, 'active')
          ON CONFLICT (email) DO UPDATE SET id = EXCLUDED.id
        `,
        [adminUserId, tenantId]
      );

      // Create a different student for this test
      await pool.query(
        `
          INSERT INTO tenant_test.students (id, first_name, last_name, class_uuid)
          VALUES ($1, 'Admin', 'Student', $2)
        `,
        [differentStudentId, otherClassId]
      );

      const client = await pool.connect();
      try {
        // Use a unique date to avoid duplicate key violation
        const uniqueDate = `2025-02-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`;
        await expect(
          markAttendance(
            client,
            'tenant_test',
            [
              {
                studentId: differentStudentId,
                classId: otherClassId,
                status: 'present',
                markedBy: adminUserId,
                date: uniqueDate
              }
            ],
            adminUserId
          )
        ).resolves.not.toThrow();
      } finally {
        client.release();
      }
    });
  });

  describe('examService.bulkUpsertGrades', () => {
    it('allows teacher to submit grades for assigned class', async () => {
      const client = await pool.connect();
      try {
        await expect(
          bulkUpsertGrades(
            client,
            'tenant_test',
            examId,
            [
              {
                studentId,
                subject: 'Mathematics',
                score: 85,
                classId: classId
              }
            ],
            teacherUserId
          )
        ).resolves.not.toThrow();
      } finally {
        client.release();
      }
    });

    it('rejects teacher from submitting grades for non-assigned class', async () => {
      const client = await pool.connect();
      try {
        await expect(
          bulkUpsertGrades(
            client,
            'tenant_test',
            examId,
            [
              {
                studentId,
                subject: 'Mathematics',
                score: 85,
                classId: otherClassId // Not assigned
              }
            ],
            teacherUserId
          )
        ).rejects.toThrow('Teacher is not assigned to this class');
      } finally {
        client.release();
      }
    });

    it('allows admin to submit grades for any class', async () => {
      const adminUserId = crypto.randomUUID();
      await pool.query(
        `
          INSERT INTO shared.users (id, email, password_hash, role, tenant_id, is_verified, status)
          VALUES ($1, 'admin2@test.com', 'hash', 'admin', $2, true, 'active')
          ON CONFLICT (email) DO UPDATE SET id = EXCLUDED.id
        `,
        [adminUserId, tenantId]
      );

      const client = await pool.connect();
      try {
        await expect(
          bulkUpsertGrades(
            client,
            'tenant_test',
            examId,
            [
              {
                studentId,
                subject: 'Mathematics',
                score: 85,
                classId: otherClassId
              }
            ],
            adminUserId
          )
        ).resolves.not.toThrow();
      } finally {
        client.release();
      }
    });
  });
});
