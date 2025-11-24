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
    role: 'admin';
    tenantId: string;
    email: string;
    tokenId: string;
  };
};

jest.mock('../src/middleware/authenticate', () => ({
  __esModule: true,
  default: (req: MockAuthRequest, _res: Response, next: NextFunction) => {
    req.user = {
      id: '11111111-2222-3333-4444-555555555555',
      role: 'admin',
      tenantId: 'tenant_alpha',
      email: 'admin@example.com',
      tokenId: 'token',
    };
    next();
  },
}));

jest.mock('../src/db/connection', () => ({
  getPool: jest.fn(),
  closePool: jest.fn(),
}));

const mockedGetPool = jest.mocked(getPool);

describe('Admin academics routes', () => {
  const authHeaders = { Authorization: 'Bearer fake', 'x-tenant-id': 'tenant_alpha' };
  let classIdA: string;
  let classIdB: string;
  let teacherId: string;
  let studentId: string;
  let termId: string;
  let subjectId: string;
  let examId: string;
  let pool: Pool;

  beforeAll(async () => {
    const testPool = await createTestPool();
    pool = testPool.pool;
    mockedGetPool.mockReturnValue(pool);

    await createTenant(
      {
        name: 'Test School',
        schemaName: 'tenant_alpha',
      },
      pool
    );

    const classResultA = await pool.query(
      `INSERT INTO tenant_alpha.classes (name, description) VALUES ('Grade 7', 'Junior high') RETURNING id`
    );
    classIdA = classResultA.rows[0].id;
    classIdB = crypto.randomUUID();
    await pool.query(
      `INSERT INTO tenant_alpha.classes (id, name, description) VALUES ($1, 'Grade 8', 'Junior high')`,
      [classIdB]
    );

    const teacherResult = await pool.query(
      `INSERT INTO tenant_alpha.teachers (name, email) VALUES ('Jane Mentor', 'jane@example.com') RETURNING id`
    );
    teacherId = teacherResult.rows[0].id;

    const termResult = await pool.query(
      `
        INSERT INTO tenant_alpha.academic_terms (name, starts_on, ends_on)
        VALUES ('Term 1', '2025-01-01', '2025-03-31')
        RETURNING id
      `
    );
    termId = termResult.rows[0].id;

    const studentResult = await pool.query(
      `
        INSERT INTO tenant_alpha.students (first_name, last_name, class_id)
        VALUES ('Alex', 'Johnson', $1)
        RETURNING id
      `,
      [classIdA]
    );
    studentId = studentResult.rows[0].id;

    const examResult = await pool.query(
      `
        INSERT INTO tenant_alpha.exams (name, exam_date)
        VALUES ('Mid Term Assessment', '2025-02-15')
        RETURNING id
      `
    );
    examId = examResult.rows[0].id;

    await pool.query(
      `
        INSERT INTO tenant_alpha.fee_invoices (student_id, amount, status, due_date)
        VALUES ($1, 500, 'partial', '2025-02-20')
      `,
      [studentId]
    );

    await pool.query(
      `
        INSERT INTO tenant_alpha.attendance_records (id, student_id, class_id, status, attendance_date)
        VALUES ($1, $2, $3, 'present', '2025-02-01')
      `,
      [crypto.randomUUID(), studentId, classIdA]
    );
    await pool.query(
      `
        INSERT INTO tenant_alpha.attendance_records (id, student_id, class_id, status, attendance_date)
        VALUES ($1, $2, $3, 'absent', '2025-02-05')
      `,
      [crypto.randomUUID(), studentId, classIdA]
    );

    await pool.query(
      `
        INSERT INTO tenant_alpha.grades (id, student_id, exam_id, subject, score, grade)
        VALUES ($1, $2, $3, 'Mathematics', 88, 'A')
      `,
      [crypto.randomUUID(), studentId, examId]
    );
    await pool.query(
      `
        INSERT INTO tenant_alpha.grades (id, student_id, exam_id, subject, score, grade)
        VALUES ($1, $2, $3, 'Science', 79, 'B')
      `,
      [crypto.randomUUID(), studentId, examId]
    );
  });

  it('manages subjects, assignments, promotions, and report export', async () => {
    const createdSubject = await request(app)
      .post('/admin/subjects')
      .set(authHeaders)
      .send({ name: 'Mathematics', code: 'MATH', description: 'Core math' })
      .expect(201);
    subjectId = createdSubject.body.id;
    expect(createdSubject.body.name).toBe('Mathematics');

    await request(app)
      .post(`/admin/classes/${classIdA}/subjects`)
      .set(authHeaders)
      .send({ subjectIds: [subjectId] })
      .expect(200);

    const classSubjects = await request(app)
      .get(`/admin/classes/${classIdA}/subjects`)
      .set(authHeaders)
      .expect(200);
    expect(classSubjects.body).toHaveLength(1);

    const assignment = await request(app)
      .post(`/admin/teachers/${teacherId}/assignments`)
      .set(authHeaders)
      .send({ classId: classIdA, subjectId, isClassTeacher: true })
      .expect(201);
    expect(assignment.body.teacher_id).toBe(teacherId);

    await request(app)
      .post(`/admin/students/${studentId}/subjects`)
      .set(authHeaders)
      .send({ subjectIds: [subjectId] })
      .expect(200);

    const promotion = await request(app)
      .post(`/admin/students/${studentId}/promote`)
      .set(authHeaders)
      .send({ toClassId: classIdB })
      .expect(200);
    // The student object has class_id as TEXT (class name) and class_uuid as UUID
    // Check class_uuid for the UUID match
    expect(promotion.body.class_uuid).toBe(classIdB);

    const reportResponse = await request(app)
      .post('/admin/reports/term')
      .set(authHeaders)
      .send({ studentId, termId })
      .expect(201);
    expect(reportResponse.headers['content-type']).toMatch(/application\/pdf/);
    expect(Buffer.isBuffer(reportResponse.body)).toBe(true);
    expect(reportResponse.body.length).toBeGreaterThan(0);

    const reportRecord = await pool.query(
      `SELECT id FROM tenant_alpha.term_reports ORDER BY generated_at DESC LIMIT 1`
    );
    const reportId = reportRecord.rows[0].id;

    const retrievePdf = await request(app)
      .get(`/admin/reports/term/${reportId}/pdf`)
      .set(authHeaders)
      .expect(200);
    expect(retrievePdf.headers['content-type']).toMatch(/application\/pdf/);
  });
});
