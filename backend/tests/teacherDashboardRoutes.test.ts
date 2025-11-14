import crypto from 'crypto';
import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import app from '../src/app';
import { createTenant } from '../src/db/tenantManager';
import { createTestPool } from './utils/testDb';
import { getPool } from '../src/db/connection';

type MockAuthRequest = Request & {
  user?: {
    id: string;
    role: 'teacher';
    tenantId: string;
    email: string;
    tokenId: string;
  };
};

// Mock user ID - will be set in beforeAll
// Use a module-level object so the mock can read the updated value
const mockUserState = { id: '' };
jest.mock('../src/middleware/authenticate', () => ({
  __esModule: true,
  default: (req: MockAuthRequest, _res: Response, next: NextFunction) => {
    // Read the current value dynamically
    const userId = mockUserState.id || '00000000-0000-0000-0000-000000000000';
    req.user = {
      id: userId,
      role: 'teacher',
      tenantId: 'tenant_alpha',
      email: 'jane@example.com',
      tokenId: 'token'
    };
    next();
  }
}));

jest.mock('../src/db/connection', () => ({
  getPool: jest.fn(),
  closePool: jest.fn()
}));

const mockedGetPool = getPool as unknown as jest.Mock;

describe('Teacher dashboard routes', () => {
  const authHeaders = { Authorization: 'Bearer fake', 'x-tenant-id': 'tenant_alpha' };
  let pool: Pool;
  let classAId: string;
  let classBId: string;
  let subjectMathId: string;
  let subjectSciId: string;
  let teacherId: string;
  let teacherUserId: string;
  let assignmentMathId: string;
  let studentAId: string;
  let studentBId: string;

  beforeAll(async () => {
    const testPool = await createTestPool();
    pool = testPool.pool;
    mockedGetPool.mockReturnValue(pool);

    const tenant = await createTenant(
      {
        name: 'Teacher School',
        schemaName: 'tenant_alpha'
      },
      pool
    );

    classAId = crypto.randomUUID();
    classBId = crypto.randomUUID();
    subjectMathId = crypto.randomUUID();
    subjectSciId = crypto.randomUUID();
    teacherId = crypto.randomUUID();
    teacherUserId = crypto.randomUUID();
    mockUserState.id = teacherUserId; // Set for mock
    assignmentMathId = crypto.randomUUID();
    const assignmentSciId = crypto.randomUUID();
    studentAId = crypto.randomUUID();
    studentBId = crypto.randomUUID();

    // Create user in shared.users for the teacher (required for verifyTeacherAssignment middleware)
    await pool.query(
      `
        INSERT INTO shared.users (id, email, password_hash, role, tenant_id, is_verified, status)
        VALUES ($1, 'jane@example.com', 'hash', 'teacher', $2, true, 'active')
        ON CONFLICT (email) DO UPDATE SET id = EXCLUDED.id
      `,
      [teacherUserId, tenant.id]
    );

    await pool.query(
      `
        INSERT INTO tenant_alpha.classes (id, name, description)
        VALUES ($1, 'Grade 7', 'Junior class'),
               ($2, 'Grade 8', 'Intermediate class')
      `,
      [classAId, classBId]
    );

    await pool.query(
      `
        INSERT INTO tenant_alpha.subjects (id, name, code)
        VALUES ($1, 'Mathematics', 'MATH'),
               ($2, 'Science', 'SCI')
      `,
      [subjectMathId, subjectSciId]
    );

    await pool.query(
      `
        INSERT INTO tenant_alpha.teachers (id, name, email, subjects)
        VALUES ($1, 'Jane Mentor', 'jane@example.com', '["Mathematics","Science"]'::jsonb)
      `,
      [teacherId]
    );

    await pool.query(
      `
        INSERT INTO tenant_alpha.teacher_assignments (id, teacher_id, class_id, subject_id, is_class_teacher)
        VALUES ($1, $4, $2, $5, TRUE),
               ($3, $4, $2, $6, FALSE)
      `,
      [assignmentMathId, classAId, assignmentSciId, teacherId, subjectMathId, subjectSciId]
    );

    await pool.query(
      `
        INSERT INTO tenant_alpha.students (id, first_name, last_name, class_id, class_uuid, parent_contacts)
        VALUES ($1, 'Alex', 'Johnson', 'Grade 7', $3, '[]'::jsonb),
               ($2, 'Maya', 'Lee', 'Grade 7', $3, '[]'::jsonb)
      `,
      [studentAId, studentBId, classAId]
    );

    await pool.query(
      `
        INSERT INTO tenant_alpha.attendance_records (id, student_id, class_id, status, attendance_date)
        VALUES ($1, $3, $4, 'present', '2025-02-01'),
               ($2, $5, $4, 'absent', '2025-02-01')
      `,
      [crypto.randomUUID(), crypto.randomUUID(), studentAId, classAId, studentBId]
    );

    const invoiceAId = crypto.randomUUID();
    const invoiceBId = crypto.randomUUID();
    await pool.query(
      `
        INSERT INTO tenant_alpha.fee_invoices (id, student_id, amount, status)
        VALUES ($1, $3, 500, 'paid'),
               ($2, $4, 400, 'pending')
      `,
      [invoiceAId, invoiceBId, studentAId, studentBId]
    );

    await pool.query(
      `
        INSERT INTO tenant_alpha.payments (id, invoice_id, provider, provider_payment_id, amount, status)
        VALUES ($1, $2, 'mock-payments', 'mock_tx_1', 500, 'succeeded')
      `,
      [crypto.randomUUID(), invoiceAId]
    );

    const examId = crypto.randomUUID();
    await pool.query(
      `
        INSERT INTO tenant_alpha.exams (id, name, exam_date)
        VALUES ($1, 'Mid Term Assessment', '2025-02-15')
      `,
      [examId]
    );

    await pool.query(
      `
        INSERT INTO tenant_alpha.grades (id, student_id, exam_id, subject, score, grade, class_id)
        VALUES ($1, $3, $5, 'Mathematics', 88, 'A', $6),
               ($2, $4, $5, 'Mathematics', 76, 'B', $6)
      `,
      [crypto.randomUUID(), crypto.randomUUID(), studentAId, studentBId, examId, classAId]
    );
  });

  it('returns overview and classes', async () => {
    const overview = await request(app).get('/teacher/overview').set(authHeaders).expect(200);
    expect(overview.body.summary.totalClasses).toBe(1);

    const classes = await request(app).get('/teacher/classes').set(authHeaders).expect(200);
    expect(classes.body).toHaveLength(1);
    expect(classes.body[0].subjects[0].name).toBe('Mathematics');
  });

  it('returns roster for assigned class', async () => {
    const roster = await request(app)
      .get(`/teacher/classes/${classAId}/roster`)
      .set(authHeaders)
      .expect(200);
    expect(roster.body).toHaveLength(2);
  });

  it('allows requesting assignment drop', async () => {
    const drop = await request(app)
      .post(`/teacher/assignments/${assignmentMathId}/drop`)
      .set(authHeaders)
      .expect(200);
    expect(drop.body.metadata.dropRequested).toBeTruthy();
  });

  it('generates class report and pdf', async () => {
    const report = await request(app)
      .get(`/teacher/reports/class/${classAId}`)
      .set(authHeaders)
      .expect(200);
    expect(report.body.attendance.total).toBeGreaterThan(0);

    const pdf = await request(app)
      .get(`/teacher/reports/class/${classAId}/pdf`)
      .set(authHeaders)
      .expect(200);
    expect(pdf.headers['content-type']).toMatch(/application\/pdf/);
  });

  it('returns messages and profile details', async () => {
    const messages = await request(app).get('/teacher/messages').set(authHeaders).expect(200);
    expect(messages.body.length).toBeGreaterThan(0);

    const profile = await request(app).get('/teacher/profile').set(authHeaders).expect(200);
    expect(profile.body.name).toBe('Jane Mentor');
  });
});
