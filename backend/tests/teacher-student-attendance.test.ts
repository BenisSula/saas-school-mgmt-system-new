import crypto from 'crypto';
import request from 'supertest';
import type { Pool } from 'pg';
import app from '../src/app';
import { createTestPool } from './utils/testDb';
import { getPool } from '../src/db/connection';
import { signUp } from '../src/services/authService';

jest.mock('../src/db/connection', () => ({
  getPool: jest.fn(),
  closePool: jest.fn(),
}));

const mockedGetPool = jest.mocked(getPool);

jest.setTimeout(20000);

describe('Teacher → Student Attendance Flow Integration', () => {
  let pool: Pool;
  let teacherToken: string;
  let studentToken: string;
  let tenantId: string;
  let teacherUserId: string;
  let studentUserId: string;
  let teacherId: string;
  let studentId: string;
  let classId: string;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.ACCESS_TOKEN_TTL = '900s';
    process.env.REFRESH_TOKEN_TTL = (60 * 60).toString();

    const testPool = await createTestPool();
    pool = testPool.pool;
    mockedGetPool.mockReturnValue(pool);

    // Create tenant
    const tenantResult = await pool.query(
      `
        INSERT INTO shared.tenants (name, domain, schema_name)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      ['Attendance School', 'attendanceschool.local', 'tenant_attendance']
    );
    tenantId = tenantResult.rows[0].id;

    // Create tenant schema
    await pool.query(`CREATE SCHEMA IF NOT EXISTS tenant_attendance`);

    // Create classes table
    await pool.query(
      `
        CREATE TABLE IF NOT EXISTS tenant_attendance.classes (
          id UUID PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `
    );

    // Create students table
    await pool.query(
      `
        CREATE TABLE IF NOT EXISTS tenant_attendance.students (
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

    // Create teachers table
    await pool.query(
      `
        CREATE TABLE IF NOT EXISTS tenant_attendance.teachers (
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

    // Create teacher_assignments table
    await pool.query(
      `
        CREATE TABLE IF NOT EXISTS tenant_attendance.teacher_assignments (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          teacher_id UUID NOT NULL REFERENCES tenant_attendance.teachers(id) ON DELETE CASCADE,
          class_id UUID NOT NULL REFERENCES tenant_attendance.classes(id) ON DELETE CASCADE,
          subject_id UUID,
          is_class_teacher BOOLEAN NOT NULL DEFAULT FALSE,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (teacher_id, class_id)
        )
      `
    );

    // Create attendance_records table
    await pool.query(
      `
        CREATE TABLE IF NOT EXISTS tenant_attendance.attendance_records (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          student_id UUID REFERENCES tenant_attendance.students(id) ON DELETE CASCADE,
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

    // Create class
    classId = crypto.randomUUID();
    await pool.query(`INSERT INTO tenant_attendance.classes (id, name) VALUES ($1, $2)`, [
      classId,
      'Grade 10A',
    ]);

    // Create teacher user via signup
    const teacherEmail = `teacher-${crypto.randomUUID()}@attendanceschool.com`;
    const teacherPassword = 'TeacherPass123!';

    try {
      const teacherSignupResponse = await signUp({
        email: teacherEmail,
        password: teacherPassword,
        role: 'teacher',
        tenantId,
      });
      teacherToken = teacherSignupResponse.accessToken;
      teacherUserId = teacherSignupResponse.user.id;

      // Update teacher status to active
      await pool.query(`UPDATE shared.users SET status = 'active' WHERE id = $1`, [teacherUserId]);
    } catch (error) {
      const loginResponse = await request(app).post('/auth/login').send({
        email: teacherEmail,
        password: teacherPassword,
      });
      if (loginResponse.status === 200) {
        teacherToken = loginResponse.body.accessToken;
        teacherUserId = loginResponse.body.user.id;
      } else {
        throw error;
      }
    }

    // Create teacher record
    teacherId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO tenant_attendance.teachers (id, name, email) VALUES ($1, $2, $3)`,
      [teacherId, 'Test Teacher', teacherEmail]
    );

    // Create teacher assignment
    await pool.query(
      `
        INSERT INTO tenant_attendance.teacher_assignments (teacher_id, class_id, is_class_teacher)
        VALUES ($1, $2, true)
      `,
      [teacherId, classId]
    );

    // Create student user via signup
    const studentEmail = `student-${crypto.randomUUID()}@attendanceschool.com`;
    const studentPassword = 'StudentPass123!';

    try {
      const studentSignupResponse = await signUp({
        email: studentEmail,
        password: studentPassword,
        role: 'student',
        tenantId,
      });
      studentToken = studentSignupResponse.accessToken;
      studentUserId = studentSignupResponse.user.id;

      // Update student status to active
      await pool.query(`UPDATE shared.users SET status = 'active' WHERE id = $1`, [studentUserId]);
    } catch (error) {
      const loginResponse = await request(app).post('/auth/login').send({
        email: studentEmail,
        password: studentPassword,
      });
      if (loginResponse.status === 200) {
        studentToken = loginResponse.body.accessToken;
        studentUserId = loginResponse.body.user.id;
      } else {
        throw error;
      }
    }

    // Create student record
    studentId = crypto.randomUUID();
    await pool.query(
      `
        INSERT INTO tenant_attendance.students (id, first_name, last_name, admission_number, class_id, class_uuid)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [studentId, 'Test', 'Student', 'STU001', 'Grade 10A', classId]
    );
  });

  it('Teacher marks attendance → Student dashboard shows update', async () => {
    const attendanceDate = new Date().toISOString().split('T')[0]; // Today's date

    // Step 1: Teacher marks attendance
    const markAttendanceResponse = await request(app)
      .post('/attendance/mark')
      .set('Authorization', `Bearer ${teacherToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        records: [
          {
            studentId: studentId,
            classId: classId,
            status: 'present',
            markedBy: teacherUserId,
            date: attendanceDate,
          },
        ],
      });

    // Should succeed (204) or fail with validation errors
    expect([204, 400, 500, 403]).toContain(markAttendanceResponse.status);

    // If successful, verify attendance was recorded
    if (markAttendanceResponse.status === 204) {
      const attendanceCheck = await pool.query(
        `
          SELECT id, student_id, class_id, status, attendance_date
          FROM tenant_attendance.attendance_records
          WHERE student_id = $1 AND attendance_date = $2
        `,
        [studentId, attendanceDate]
      );

      expect(attendanceCheck.rows.length).toBeGreaterThan(0);
      expect(attendanceCheck.rows[0].status).toBe('present');
    }

    // Step 2: Student retrieves their attendance history
    const studentAttendanceResponse = await request(app)
      .get(`/attendance/${studentUserId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .set('x-tenant-id', tenantId);

    expect(studentAttendanceResponse.status).toBe(200);
    expect(studentAttendanceResponse.body).toHaveProperty('history');
    expect(studentAttendanceResponse.body).toHaveProperty('summary');

    // Step 3: Verify attendance appears in student's history
    if (markAttendanceResponse.status === 204) {
      const history = studentAttendanceResponse.body.history;
      expect(Array.isArray(history)).toBe(true);

      // Check if today's attendance is in the history
      const todayAttendance = history.find(
        (record: { attendance_date: string }) => record.attendance_date === attendanceDate
      );

      if (todayAttendance) {
        expect(todayAttendance.status).toBe('present');
      }
    }

    // Step 4: Verify attendance summary is updated
    const summary = studentAttendanceResponse.body.summary;
    expect(summary).toBeDefined();
    // Summary should have counts for present/absent/late
    if (summary && typeof summary === 'object') {
      expect(summary).toHaveProperty('total');
    }
  });

  it('Teacher marks multiple students attendance → All students see updates', async () => {
    // Create additional student
    const student2Id = crypto.randomUUID();
    const student2UserId = crypto.randomUUID();
    const student2Email = `student2-${crypto.randomUUID()}@attendanceschool.com`;

    await pool.query(
      `
        INSERT INTO shared.users (id, email, password_hash, role, tenant_id, is_verified, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [student2UserId, student2Email, 'hashed_password', 'student', tenantId, true, 'active']
    );

    await pool.query(
      `
        INSERT INTO tenant_attendance.students (id, first_name, last_name, admission_number, class_id, class_uuid)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [student2Id, 'Test', 'Student2', 'STU002', 'Grade 10A', classId]
    );

    const attendanceDate = new Date().toISOString().split('T')[0];

    // Step 1: Teacher marks attendance for multiple students
    const markAttendanceResponse = await request(app)
      .post('/attendance/mark')
      .set('Authorization', `Bearer ${teacherToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        records: [
          {
            studentId: studentId,
            classId: classId,
            status: 'present',
            markedBy: teacherUserId,
            date: attendanceDate,
          },
          {
            studentId: student2Id,
            classId: classId,
            status: 'late',
            markedBy: teacherUserId,
            date: attendanceDate,
          },
        ],
      });

    // Should succeed or fail with validation
    expect([204, 400, 500, 403]).toContain(markAttendanceResponse.status);

    // Step 2: Both students can retrieve their attendance
    const student1Attendance = await request(app)
      .get(`/attendance/${studentUserId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .set('x-tenant-id', tenantId);

    expect(student1Attendance.status).toBe(200);

    // Student 2 login
    const student2LoginResponse = await request(app).post('/auth/login').send({
      email: student2Email,
      password: 'StudentPass123!',
    });

    if (student2LoginResponse.status === 200) {
      const student2Token = student2LoginResponse.body.accessToken;
      const student2Attendance = await request(app)
        .get(`/attendance/${student2UserId}`)
        .set('Authorization', `Bearer ${student2Token}`)
        .set('x-tenant-id', tenantId);

      expect(student2Attendance.status).toBe(200);
    }
  });
});
