import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import app from '../src/app';
import { createTestPool } from './utils/testDb';
import { getPool } from '../src/db/connection';
import { computeStudentResult } from '../src/services/examService';

type MockAuthRequest = Request & {
  user?: {
    id: string;
    role: 'admin' | 'teacher' | 'student' | 'superadmin';
    tenantId: string;
    email: string;
    tokenId: string;
  };
};

type StudentResult = Awaited<ReturnType<typeof computeStudentResult>>;

const currentUser: NonNullable<MockAuthRequest['user']> = {
  id: 'admin-user',
  role: 'admin',
  tenantId: 'tenant_alpha',
  email: 'admin@test.com',
  tokenId: 'token'
};

jest.mock('../src/middleware/authenticate', () => ({
  __esModule: true,
  default: (req: MockAuthRequest, _res: Response, next: NextFunction) => {
    req.user = { ...currentUser };
    next();
  }
}));

jest.mock('../src/middleware/tenantResolver', () => {
  const actual = jest.requireActual('../src/middleware/tenantResolver');
  return actual;
});

jest.mock('../src/db/connection', () => ({
  getPool: jest.fn(),
  closePool: jest.fn()
}));

jest.mock('../src/services/examService', () => {
  const actual = jest.requireActual('../src/services/examService');
  return {
    ...actual,
    computeStudentResult: jest.fn()
  };
});

const mockedGetPool = jest.mocked(getPool);
const computeStudentResultMock = computeStudentResult as jest.MockedFunction<
  typeof computeStudentResult
>;

describe('Results routes RBAC', () => {
  const headers = { Authorization: 'Bearer fake', 'x-tenant-id': 'tenant_alpha' };
  let pool: Pool;
  let studentAId: string;
  let studentBId: string;
  let tenantId: string;
  let classId: string;
  let adminUserId: string;
  const examId = crypto.randomUUID();

  beforeAll(async () => {
    const testPool = await createTestPool();
    pool = testPool.pool;
    mockedGetPool.mockReturnValue(pool);
    tenantId = crypto.randomUUID();
    adminUserId = crypto.randomUUID();
    await pool.query(
      `
        CREATE TABLE IF NOT EXISTS tenant_alpha.audit_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID,
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id UUID,
          details JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `
    );

    await pool.query(
      "INSERT INTO shared.tenants (id, name, schema_name) VALUES ($1, 'Results School', 'tenant_alpha') ON CONFLICT (schema_name) DO NOTHING",
      [tenantId]
    );

    classId = crypto.randomUUID();
    studentAId = crypto.randomUUID();
    studentBId = crypto.randomUUID();

    await pool.query("INSERT INTO tenant_alpha.classes (id, name) VALUES ($1, 'Grade 9')", [
      classId
    ]);

    await pool.query(
      "INSERT INTO tenant_alpha.students (id, first_name, last_name, parent_contacts, class_id) VALUES ($1, 'Alex', 'One', '[]'::jsonb, $3), ($2, 'Maya', 'Two', '[]'::jsonb, $3)",
      [studentAId, studentBId, classId]
    );
  });

  beforeEach(() => {
    Object.assign(currentUser, {
      id: adminUserId,
      role: 'admin' as const,
      tenantId,
      email: 'admin@test.com'
    });
    computeStudentResultMock.mockReset();
  });

  it('forbids a student from accessing another student exam results and logs the attempt', async () => {
    Object.assign(currentUser, {
      id: studentAId,
      role: 'student' as const,
      email: 'studentA@test.com',
      tenantId
    });

    const before = await pool.query(
      "SELECT COUNT(*)::int AS count FROM tenant_alpha.audit_logs WHERE action = 'UNAUTHORIZED_ACCESS_ATTEMPT'"
    );
    const beforeCount = before.rows[0].count as number;

    const res = await request(app)
      .get(`/results/${studentBId}`)
      .set(headers)
      .query({ exam_id: examId });

    expect(res.status).toBe(403);
    expect(computeStudentResultMock).not.toHaveBeenCalled();

    const after = await pool.query(
      "SELECT COUNT(*)::int AS count FROM tenant_alpha.audit_logs WHERE action = 'UNAUTHORIZED_ACCESS_ATTEMPT'"
    );
    const afterCount = after.rows[0].count as number;

    expect(afterCount).toBe(beforeCount + 1);
  });

  it('allows an admin to fetch any student exam results', async () => {
    Object.assign(currentUser, {
      id: 'admin-user',
      role: 'admin' as const,
      email: 'admin@test.com',
      tenantId
    });

    const mockResult: StudentResult = {
      exam: null,
      summary: {
        studentId: studentBId,
        total: 95,
        average: 95,
        percentage: 95,
        grade: 'A',
        position: null
      },
      subjects: [],
      aggregates: {
        highest: 95,
        lowest: 95,
        classAverage: 95
      },
      leaderboard: []
    };

    computeStudentResultMock.mockResolvedValue(mockResult);

    const res = await request(app)
      .get(`/results/${studentBId}`)
      .set(headers)
      .query({ exam_id: examId });

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual(mockResult.summary);
    expect(res.body.aggregates).toEqual(mockResult.aggregates);
    expect(computeStudentResultMock).toHaveBeenCalled();
  });
});
