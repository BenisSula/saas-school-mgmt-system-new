import crypto from 'crypto';
import type { Response, NextFunction } from 'express';
import type { Pool, PoolClient } from 'pg';
import { createTestPool } from './utils/testDb';
import { getPool } from '../src/db/connection';
import { requirePermission, requireRole, requireSelfOrPermission } from '../src/middleware/rbac';
import { AuthenticatedRequest } from '../src/middleware/rbac';

jest.mock('../src/db/connection', () => ({
  getPool: jest.fn(),
  closePool: jest.fn(),
}));

const mockedGetPool = jest.mocked(getPool);

describe('RBAC Middleware Unit Tests', () => {
  let pool: Pool;
  let tenantClient: PoolClient;
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeAll(async () => {
    const testPool = await createTestPool();
    pool = testPool.pool;
    mockedGetPool.mockReturnValue(pool);

    // Create tenant for audit logs
    await pool.query(
      `
          INSERT INTO shared.tenants (name, domain, schema_name)
          VALUES ($1, $2, $3)
          ON CONFLICT (schema_name) DO NOTHING
        `,
      ['Test Tenant', 'test.local', 'tenant_test']
    );

    await pool.query(`CREATE SCHEMA IF NOT EXISTS tenant_test`);
  });

  beforeEach(async () => {
    tenantClient = await pool.connect();
    mockReq = {
      user: {
        id: crypto.randomUUID(),
        role: 'teacher',
        tenantId: crypto.randomUUID(),
        email: 'test@example.com',
        tokenId: 'token123',
      },
      tenantClient,
      tenant: {
        id: crypto.randomUUID(),
        name: 'Test Tenant',
        schema: 'tenant_test',
      },
      originalUrl: '/test',
      path: '/test',
      method: 'GET',
      params: {},
      body: {},
      query: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    if (tenantClient) {
      tenantClient.release();
    }
  });

  describe('requirePermission', () => {
    it('allows access when user has required permission', () => {
      mockReq.user!.role = 'teacher';
      // Teachers have 'attendance:mark' permission
      requirePermission('attendance:mark')(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('denies access when user lacks required permission', () => {
      mockReq.user!.role = 'student';
      requirePermission('attendance:manage')(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Forbidden' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('denies access when user is undefined', () => {
      mockReq.user = undefined;
      requirePermission('attendance:manage')(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Forbidden' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('allows admin to access admin-only permissions', () => {
      mockReq.user!.role = 'admin';
      requirePermission('users:manage')(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('allows superadmin to access all permissions', () => {
      mockReq.user!.role = 'superadmin';
      requirePermission('tenants:manage')(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('allows access when user has required role', async () => {
      mockReq.user!.role = 'teacher';
      await requireRole(['teacher'])(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('denies access when user lacks required role', async () => {
      mockReq.user!.role = 'student';
      await requireRole(['teacher', 'admin'])(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('allows superadmin when admin is in allowed roles', async () => {
      mockReq.user!.role = 'superadmin';
      await requireRole(['admin'])(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('denies access when user is undefined', async () => {
      mockReq.user = undefined;
      await requireRole(['teacher'])(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Unauthenticated' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('allows access when user role matches any allowed role', async () => {
      mockReq.user!.role = 'hod';
      await requireRole(['teacher', 'hod', 'admin'])(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireSelfOrPermission', () => {
    it('allows access when user accesses their own resource', async () => {
      const userId = crypto.randomUUID();
      mockReq.user!.id = userId;
      mockReq.params = { studentId: userId };

      await requireSelfOrPermission('students:manage', 'studentId')(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('allows access when user has required permission', async () => {
      mockReq.user!.role = 'admin';
      mockReq.user!.id = 'user1';
      mockReq.params = { studentId: 'user2' };

      await requireSelfOrPermission('students:manage', 'studentId')(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('allows superadmin to access any resource', async () => {
      mockReq.user!.role = 'superadmin';
      mockReq.user!.id = 'user1';
      mockReq.params = { studentId: 'user2' };

      await requireSelfOrPermission('students:manage', 'studentId')(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('denies access when user lacks permission and is not accessing own resource', async () => {
      mockReq.user!.role = 'student';
      mockReq.user!.id = 'user1';
      mockReq.params = { studentId: 'user2' };

      await requireSelfOrPermission('students:manage', 'studentId')(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('returns 400 when targetId is missing', async () => {
      mockReq.user!.id = 'user1';
      mockReq.params = {};

      await requireSelfOrPermission('students:manage', 'studentId')(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('extracts targetId from body when not in params', async () => {
      const userId = crypto.randomUUID();
      mockReq.user!.id = userId;
      mockReq.params = {};
      mockReq.body = { studentId: userId };

      await requireSelfOrPermission('students:manage', 'studentId')(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('extracts targetId from query when not in params or body', async () => {
      const userId = crypto.randomUUID();
      mockReq.user!.id = userId;
      mockReq.params = {};
      mockReq.body = {};
      mockReq.query = { studentId: userId };

      await requireSelfOrPermission('students:manage', 'studentId')(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('denies access when user is undefined', async () => {
      mockReq.user = undefined;
      mockReq.params = { studentId: 'user1' };

      await requireSelfOrPermission('students:manage', 'studentId')(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Unauthenticated' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('allows access without permission when accessing own resource', async () => {
      const userId = crypto.randomUUID();
      mockReq.user!.id = userId;
      mockReq.user!.role = 'student';
      mockReq.params = { studentId: userId };

      await requireSelfOrPermission(undefined, 'studentId')(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
