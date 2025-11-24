import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import app from '../src/app';
import { createTestPool } from './utils/testDb';
import { createTenant } from '../src/db/tenantManager';
import { getPool } from '../src/db/connection';

type MockAuthRequest = Request & {
  user?: {
    id: string;
    role: 'teacher' | 'admin' | 'superadmin';
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
      email: 'admin@test.com',
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

describe('Examination routes', () => {
  let examId: string;
  let studentId: string;

  const headers = { Authorization: 'Bearer fake', 'x-tenant-id': 'tenant_alpha' };

  beforeAll(async () => {
    const { pool } = await createTestPool();
    mockedGetPool.mockReturnValue(pool);

    await createTenant(
      {
        name: 'Alpha Academy',
        schemaName: 'tenant_alpha',
      },
      pool
    );

    const studentInsert = await pool.query(
      `
        INSERT INTO tenant_alpha.students (first_name, last_name, admission_number)
        VALUES ('Ada', 'Lovelace', 'A-1001')
        RETURNING id
      `
    );
    studentId = studentInsert.rows[0].id;
  });

  it('creates exam and schedules sessions', async () => {
    const examResponse = await request(app).post('/exams').set(headers).send({
      name: 'Term 1 Assessment',
      description: 'Mid-term exam',
      examDate: '2025-02-15',
    });

    expect(examResponse.status).toBe(201);
    examId = examResponse.body.id;
    expect(examResponse.body.name).toBe('Term 1 Assessment');

    const sessionResponse = await request(app).post(`/exams/${examId}/sessions`).set(headers).send({
      classId: 'Grade-10',
      subject: 'Mathematics',
      scheduledAt: '2025-02-16T09:00:00.000Z',
      invigilator: 'Prof. Turing',
    });

    expect(sessionResponse.status).toBe(201);
    expect(sessionResponse.body.subject).toBe('Mathematics');
  });

  it('records grades in bulk and generates results', async () => {
    const gradeResponse = await request(app)
      .post('/grades/bulk')
      .set(headers)
      .send({
        examId,
        entries: [
          {
            studentId,
            subject: 'Mathematics',
            score: 88,
            remarks: 'Strong work',
            classId: 'Grade-10',
          },
          {
            studentId,
            subject: 'Science',
            score: 92,
            classId: 'Grade-10',
          },
        ],
      });

    if (gradeResponse.status !== 200) {
      throw new Error(`Grade save failed: ${JSON.stringify(gradeResponse.body)}`);
    }
    expect(gradeResponse.status).toBe(200);
    expect(gradeResponse.body.saved).toBe(2);

    const results = await request(app)
      .get(`/results/${studentId}`)
      .set(headers)
      .query({ exam_id: examId });

    if (results.status !== 200) {
      throw new Error(`Results fetch failed: ${JSON.stringify(results.body)}`);
    }
    expect(results.status).toBe(200);
    expect(results.body.summary.total).toBeCloseTo(180);
    expect(results.body.summary.grade).toBe('A+');
    expect(results.body.subjects).toHaveLength(2);
    expect(results.body.leaderboard[0].position).toBe(1);
  });

  it('exports exam results as CSV', async () => {
    const exportResponse = await request(app)
      .get(`/results/${examId}/export`)
      .set(headers)
      .query({ format: 'csv' });

    if (exportResponse.status !== 200) {
      throw new Error(`Export failed: ${JSON.stringify(exportResponse.body)}`);
    }
    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers['content-type']).toContain('text/csv');
    expect(exportResponse.text).toContain('Mathematics');
  });
});
