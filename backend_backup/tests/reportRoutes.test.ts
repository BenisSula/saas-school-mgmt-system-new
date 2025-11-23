import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import type { Pool } from 'pg';
import app from '../src/app';
import { createTestPool } from './utils/testDb';
import { createTenant } from '../src/db/tenantManager';
import { getPool } from '../src/db/connection';

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    role: string;
    tenantId: string;
    email: string;
    tokenId: string;
  };
};

jest.mock('../src/middleware/authenticate', () => ({
  __esModule: true,
  default: (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    req.user = {
      id: 'admin-user',
      role: 'admin',
      tenantId: 'tenant_alpha',
      email: 'admin@test.com',
      tokenId: 'token'
    };
    next();
  }
}));

jest.mock('../src/db/connection', () => ({
  getPool: jest.fn(),
  closePool: jest.fn()
}));

const mockedGetPool = jest.mocked(getPool);

describe('Report routes', () => {
  const headers = { Authorization: 'Bearer fake', 'x-tenant-id': 'tenant_alpha' };
  let pool: Pool;
  let examId: string;

  beforeAll(async () => {
    const result = await createTestPool();
    pool = result.pool;
    mockedGetPool.mockReturnValue(pool);

    await createTenant(
      {
        name: 'Alpha Academy',
        schemaName: 'tenant_alpha'
      },
      pool
    );

    const studentId = randomUUID();
    const secondStudentId = randomUUID();
    const classId = 'grade-10';
    const teacherId = randomUUID();
    examId = randomUUID();

    await pool.query(
      `INSERT INTO tenant_alpha.students (id, first_name, last_name, admission_number, class_id)
       VALUES ($1, 'Jane', 'Doe', 'AD-100', $2)`,
      [studentId, classId]
    );
    await pool.query(
      `INSERT INTO tenant_alpha.students (id, first_name, last_name, admission_number, class_id)
       VALUES ($1, 'John', 'Smith', 'AD-101', $2)`,
      [secondStudentId, classId]
    );

    await pool.query(
      `INSERT INTO tenant_alpha.attendance_records (id, student_id, class_id, status, attendance_date, marked_by)
       VALUES
         (uuid_generate_v4(), $1, $3, 'present', '2025-01-01', $4),
         (uuid_generate_v4(), $2, $3, 'late', '2025-01-01', $4)`,
      [studentId, secondStudentId, classId, teacherId]
    );

    await pool.query(
      `INSERT INTO tenant_alpha.exams (id, name, exam_date) VALUES ($1, 'Mid Term', '2025-02-01')`,
      [examId]
    );
    await pool.query(
      `INSERT INTO tenant_alpha.grades (id, student_id, exam_id, subject, score, grade, class_id)
       VALUES
        (uuid_generate_v4(), $1, $2, 'Mathematics', 90, 'A', $3),
        (uuid_generate_v4(), $1, $2, 'Science', 78, 'B', $3)`,
      [studentId, examId, classId]
    );

    const invoiceId = randomUUID();
    await pool.query(
      `INSERT INTO tenant_alpha.fee_invoices (id, student_id, amount, status, due_date)
       VALUES ($1, $2, 500, 'pending', '2025-03-01')`,
      [invoiceId, studentId]
    );
    await pool.query(
      `INSERT INTO tenant_alpha.payments (id, invoice_id, provider, provider_payment_id, amount, status)
       VALUES (uuid_generate_v4(), $1, 'mock', 'txn_123', 200, 'succeeded')`,
      [invoiceId]
    );
  });

  it('returns attendance summary', async () => {
    const response = await request(app)
      .get('/reports/attendance?from=2025-01-01&to=2025-01-01')
      .set(headers);

    expect(response.status).toBe(200);
    type AttendanceRow = { status: string; count: number };
    const attendanceRows = response.body as AttendanceRow[];
    const counts = Object.fromEntries(attendanceRows.map((row) => [row.status, Number(row.count)]));
    expect(counts.present).toBe(1);
    expect(counts.late).toBe(1);
  });

  it('returns grade distribution', async () => {
    const response = await request(app)
      .get('/reports/grades')
      .query({ exam_id: examId })
      .set(headers);

    type GradeRow = { subject: string; grade: string; count: number };
    const gradeRows = response.body as GradeRow[];
    expect(response.status).toBe(200);
    expect(gradeRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ subject: 'Mathematics', grade: 'A', count: 1 }),
        expect.objectContaining({ subject: 'Science', grade: 'B', count: 1 })
      ])
    );
  });

  it('returns fee outstanding summary', async () => {
    const response = await request(app).get('/reports/fees').set(headers);

    expect(response.status).toBe(200);
    const feeRows = response.body as Array<{
      status: string;
      invoice_count: number | string;
      total_amount: number | string;
      total_paid: number | string;
    }>;
    const pending = feeRows.find((row) => row.status === 'pending');
    expect(pending).toBeDefined();
    expect(Number(pending?.invoice_count)).toBe(1);
    expect(Number(pending?.total_amount)).toBe(500);
    expect(Number(pending?.total_paid)).toBe(200);
  });
});
