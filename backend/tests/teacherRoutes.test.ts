import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import app from '../src/app';
import { createTestPool } from './utils/testDb';
import { getPool } from '../src/db/connection';
import {
  createClassReportPdf,
  findTeacherByEmail,
  getTeacherOverview,
  listTeacherClasses,
  listTeacherMessages,
  type TeacherRecord,
} from '../src/services/teacherDashboardService';

type MockAuthRequest = Request & {
  user?: {
    id: string;
    role: 'teacher' | 'student' | 'admin' | 'superadmin';
    tenantId: string;
    email: string;
    tokenId: string;
  };
};

type TeacherOverview = Awaited<ReturnType<typeof getTeacherOverview>>;
type TeacherClasses = Awaited<ReturnType<typeof listTeacherClasses>>;
type TeacherMessages = Awaited<ReturnType<typeof listTeacherMessages>>;

const currentUser: NonNullable<MockAuthRequest['user']> = {
  id: '', // Will be set in beforeAll
  role: 'teacher',
  tenantId: 'tenant_alpha',
  email: 'teacher@example.com',
  tokenId: 'token',
};

jest.mock('../src/middleware/authenticate', () => ({
  __esModule: true,
  default: (req: MockAuthRequest, _res: Response, next: NextFunction) => {
    req.user = { ...currentUser };
    next();
  },
}));

jest.mock('../src/middleware/tenantResolver', () => {
  const actual = jest.requireActual('../src/middleware/tenantResolver');
  return actual;
});

jest.mock('../src/db/connection', () => ({
  getPool: jest.fn(),
  closePool: jest.fn(),
}));

jest.mock('../src/services/teacherDashboardService', () => {
  const actual = jest.requireActual('../src/services/teacherDashboardService');
  return {
    ...actual,
    createClassReportPdf: jest.fn(),
    findTeacherByEmail: jest.fn(),
    getTeacherOverview: jest.fn(),
    listTeacherClasses: jest.fn(),
    listTeacherMessages: jest.fn(),
  };
});

const mockedGetPool = jest.mocked(getPool);
const findTeacherByEmailMock = findTeacherByEmail as jest.MockedFunction<typeof findTeacherByEmail>;
const getTeacherOverviewMock = getTeacherOverview as jest.MockedFunction<typeof getTeacherOverview>;
const listTeacherClassesMock = listTeacherClasses as jest.MockedFunction<typeof listTeacherClasses>;
const listTeacherMessagesMock = listTeacherMessages as jest.MockedFunction<
  typeof listTeacherMessages
>;
const createClassReportPdfMock = createClassReportPdf as jest.MockedFunction<
  typeof createClassReportPdf
>;

describe('Teacher routes RBAC', () => {
  const headers = { Authorization: 'Bearer fake', 'x-tenant-id': 'tenant_alpha' };
  let pool: Pool;
  let tenantId: string;
  let teacherUserId: string;
  let teacherRecord: TeacherRecord;

  beforeAll(async () => {
    const testPool = await createTestPool();
    pool = testPool.pool;
    mockedGetPool.mockReturnValue(pool);
    tenantId = crypto.randomUUID();
    teacherUserId = crypto.randomUUID();
    currentUser.id = teacherUserId; // Update mock with actual UUID
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
      "INSERT INTO shared.tenants (id, name, schema_name) VALUES ($1, 'Teacher RBAC School', 'tenant_alpha') ON CONFLICT (schema_name) DO NOTHING",
      [tenantId]
    );
  });

  beforeEach(() => {
    Object.assign(currentUser, {
      id: teacherUserId,
      role: 'teacher' as const,
      tenantId,
      email: 'teacher@example.com',
    });

    teacherRecord = {
      id: teacherUserId,
      name: 'Teacher Example',
      email: 'teacher@example.com',
      subjects: [],
    };

    const overviewMock: TeacherOverview = {
      teacher: {
        id: teacherRecord.id,
        name: teacherRecord.name,
        email: teacherRecord.email,
      },
      summary: {
        totalClasses: 0,
        totalSubjects: 0,
        classTeacherRoles: 0,
        pendingDropRequests: 0,
      },
      assignments: [],
    };

    const classesMock: TeacherClasses = [];
    const messagesMock: TeacherMessages = [];

    findTeacherByEmailMock.mockResolvedValue(teacherRecord);
    getTeacherOverviewMock.mockResolvedValue(overviewMock);
    listTeacherClassesMock.mockResolvedValue(classesMock);
    listTeacherMessagesMock.mockResolvedValue(messagesMock);
    createClassReportPdfMock.mockResolvedValue(Buffer.from('pdf'));
  });

  it('forbids students from accessing teacher routes and logs the attempt', async () => {
    Object.assign(currentUser, {
      id: 'student-user',
      role: 'student' as const,
      email: 'student@example.com',
      tenantId,
    });

    const before = await pool.query(
      "SELECT COUNT(*)::int AS count FROM tenant_alpha.audit_logs WHERE action = 'UNAUTHORIZED_ACCESS_ATTEMPT'"
    );
    const beforeCount = before.rows[0].count as number;

    const res = await request(app).get('/teacher/overview').set(headers);

    expect(res.status).toBe(403);
    expect(findTeacherByEmailMock).not.toHaveBeenCalled();

    const after = await pool.query(
      "SELECT COUNT(*)::int AS count FROM tenant_alpha.audit_logs WHERE action = 'UNAUTHORIZED_ACCESS_ATTEMPT'"
    );
    const afterCount = after.rows[0].count as number;

    expect(afterCount).toBe(beforeCount + 1);
  });

  it('allows teachers to access their overview', async () => {
    const res = await request(app).get('/teacher/overview').set(headers);

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      totalClasses: 0,
      totalSubjects: 0,
      classTeacherRoles: 0,
      pendingDropRequests: 0,
    });
    expect(findTeacherByEmailMock).toHaveBeenCalled();
  });
});
