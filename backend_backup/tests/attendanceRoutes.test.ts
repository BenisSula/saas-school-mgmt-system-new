import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import app from '../src/app';
import { createTestPool } from './utils/testDb';
import { getPool } from '../src/db/connection';

type MockAuthRequest = Request & {
  user?: {
    id: string;
    role: 'admin' | 'teacher' | 'student' | 'superadmin';
    tenantId: string;
    email: string;
    tokenId: string;
  };
};

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

const mockedGetPool = jest.mocked(getPool);

describe('Attendance routes', () => {
  const headers = { Authorization: 'Bearer fake', 'x-tenant-id': 'tenant_alpha' };
  let pool: Pool;
  let classId: string;
  let studentAId: string;
  let studentBId: string;
  let tenantId: string;
  let adminUserId: string;

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
      `
        INSERT INTO shared.tenants (id, name, schema_name)
        VALUES ($1, 'Attendance School', 'tenant_alpha')
        ON CONFLICT (schema_name) DO NOTHING
      `,
      [tenantId]
    );

    classId = crypto.randomUUID();
    studentAId = crypto.randomUUID();
    studentBId = crypto.randomUUID();

    await pool.query(
      `
        INSERT INTO tenant_alpha.classes (id, name, description)
        VALUES ($1, 'Class A', 'Primary cohort')
      `,
      [classId]
    );

    await pool.query(
      `
        INSERT INTO tenant_alpha.students (id, first_name, last_name, admission_number, class_id, parent_contacts)
        VALUES ($1, 'Test', 'Student', 'ADM-001', $3, '[]'::jsonb),
               ($2, 'Other', 'Student', 'ADM-002', $3, '[]'::jsonb)
      `,
      [studentAId, studentBId, classId]
    );

    await pool.query(
      `
        INSERT INTO tenant_alpha.attendance_records (student_id, class_id, status, marked_by, attendance_date, metadata)
        VALUES ($1, $2, 'present', $3, $4, '{}'::jsonb)
      `,
      [studentBId, classId, adminUserId, '2025-01-01']
    );
  });

  beforeEach(() => {
    Object.assign(currentUser, {
      id: adminUserId,
      role: 'admin',
      tenantId,
      email: 'admin@test.com'
    });
  });

  it('forbids a student from accessing another student attendance and logs the attempt', async () => {
    Object.assign(currentUser, {
      id: studentAId,
      role: 'student' as const,
      email: 'studentA@example.com',
      tenantId
    });

    const before = await pool.query(
      `SELECT COUNT(*)::int AS count FROM tenant_alpha.audit_logs WHERE action = 'UNAUTHORIZED_ACCESS_ATTEMPT'`
    );
    const beforeCount = before.rows[0].count as number;

    const res = await request(app).get(`/attendance/${studentBId}`).set(headers);

    expect(res.status).toBe(403);

    const after = await pool.query(
      `SELECT COUNT(*)::int AS count FROM tenant_alpha.audit_logs WHERE action = 'UNAUTHORIZED_ACCESS_ATTEMPT'`
    );
    const afterCount = after.rows[0].count as number;

    expect(afterCount).toBe(beforeCount + 1);
  });
});
