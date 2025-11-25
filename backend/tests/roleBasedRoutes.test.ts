/**
 * Role-Based Route Access Tests
 *
 * Tests that routes are properly protected by RBAC permissions
 * and that users can only access routes they have permission for.
 */

import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
import app from '../src/app';
import { createTestPool } from './utils/testDb';
import { getPool } from '../src/db/connection';
import { createTenant } from '../src/db/tenantManager';
import type { Pool } from 'pg';
import crypto from 'crypto';
import type { Role } from '../src/config/permissions';

type MockAuthRequest = Request & {
  user?: {
    id: string;
    role: Role;
    tenantId: string;
    email: string;
    tokenId: string;
  };
};

// Store current user for mock
let currentMockUser: NonNullable<MockAuthRequest['user']> | null = null;

jest.mock('../src/middleware/authenticate', () => ({
  __esModule: true,
  default: (req: MockAuthRequest, _res: Response, next: NextFunction) => {
    if (currentMockUser) {
      req.user = { ...currentMockUser };
    }
    next();
  },
}));

jest.mock('../src/db/connection', () => ({
  getPool: jest.fn(),
  closePool: jest.fn(),
}));

const mockedGetPool = jest.mocked(getPool);

describe('Role-Based Route Access', () => {
  let pool: Pool;
  let tenantId: string;
  let studentUserId: string;
  let teacherUserId: string;
  let adminUserId: string;
  let superadminUserId: string;

  beforeAll(async () => {
    const testPool = await createTestPool();
    pool = testPool.pool;
    mockedGetPool.mockReturnValue(pool);

    // Create tenant
    tenantId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO shared.tenants (id, name, domain, schema_name, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (schema_name) DO NOTHING`,
      [tenantId, 'Test School', 'test.local', 'tenant_test', 'active']
    );
    await pool.query('CREATE SCHEMA IF NOT EXISTS tenant_test');
    await createTenant({ name: 'Test School', schemaName: 'tenant_test' }, pool);

    // Create user IDs for each role
    studentUserId = crypto.randomUUID();
    teacherUserId = crypto.randomUUID();
    adminUserId = crypto.randomUUID();
    superadminUserId = crypto.randomUUID();

    // Create users in database
    const roles = [
      { id: studentUserId, role: 'student' as Role, email: 'student@test.com' },
      { id: teacherUserId, role: 'teacher' as Role, email: 'teacher@test.com' },
      { id: adminUserId, role: 'admin' as Role, email: 'admin@test.com' },
      { id: superadminUserId, role: 'superadmin' as Role, email: 'superadmin@test.com' },
    ];

    for (const { id, role, email } of roles) {
      const passwordHash = '$argon2id$v=19$m=65536,t=3,p=4$test';
      await pool.query(
        `INSERT INTO shared.users (id, email, password_hash, role, status, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO UPDATE SET role = $4`,
        [id, email, passwordHash, role, 'active', role === 'superadmin' ? null : tenantId]
      );
    }
  });

  const getAuthHeaders = (userId: string, role: Role, includeTenant = true) => {
    // Set current mock user
    currentMockUser = {
      id: userId,
      role,
      tenantId: role === 'superadmin' ? '' : tenantId,
      email: `${role}@test.com`,
      tokenId: 'test-token',
    };

    const headers: Record<string, string> = {
      Authorization: 'Bearer fake-token',
    };
    if (includeTenant && role !== 'superadmin') {
      headers['x-tenant-id'] = tenantId;
    }
    return headers;
  };

  describe('Student Routes', () => {
    it('should allow student to view own attendance', async () => {
      const response = await request(app)
        .get(`/attendance/${studentUserId}`)
        .set(getAuthHeaders(studentUserId, 'student'));

      // Should not be 403 (forbidden) - might be 404 if student doesn't exist, which is OK
      expect([200, 404]).toContain(response.status);
    });

    it('should deny student access to manage students', async () => {
      const response = await request(app)
        .get('/students')
        .set(getAuthHeaders(studentUserId, 'student'));

      expect(response.status).toBe(403);
    });

    it('should deny student access to manage users', async () => {
      const response = await request(app)
        .get('/users')
        .set(getAuthHeaders(studentUserId, 'student'));

      expect(response.status).toBe(403);
    });
  });

  describe('Teacher Routes', () => {
    it('should allow teacher to mark attendance', async () => {
      const response = await request(app)
        .post('/attendance/mark')
        .set(getAuthHeaders(teacherUserId, 'teacher'))
        .send({
          records: [
            {
              studentId: studentUserId,
              classId: 'class-1',
              status: 'present',
              markedBy: teacherUserId,
              date: '2024-01-01',
            },
          ],
        });

      // Might be 400/404 if data doesn't exist, but not 403
      expect(response.status).not.toBe(403);
    });

    it('should allow teacher to enter grades', async () => {
      const response = await request(app)
        .post('/grades/bulk')
        .set(getAuthHeaders(teacherUserId, 'teacher'))
        .send({
          examId: crypto.randomUUID(),
          entries: [],
        });

      // Might be 400/404, but not 403
      expect(response.status).not.toBe(403);
    });

    it('should deny teacher access to manage users', async () => {
      const response = await request(app)
        .get('/users')
        .set(getAuthHeaders(teacherUserId, 'teacher'));

      expect(response.status).toBe(403);
    });

    it('should deny teacher access to manage branding', async () => {
      const response = await request(app)
        .get('/configuration/branding')
        .set(getAuthHeaders(teacherUserId, 'teacher'));

      expect(response.status).toBe(403);
    });
  });

  describe('Admin Routes', () => {
    it('should allow admin to manage students', async () => {
      const response = await request(app)
        .get('/students')
        .set(getAuthHeaders(adminUserId, 'admin'));

      expect([200, 404]).toContain(response.status);
    });

    it('should allow admin to manage users', async () => {
      const response = await request(app).get('/users').set(getAuthHeaders(adminUserId, 'admin'));

      expect([200, 404]).toContain(response.status);
    });

    it('should allow admin to manage branding', async () => {
      const response = await request(app)
        .get('/configuration/branding')
        .set(getAuthHeaders(adminUserId, 'admin'));

      expect([200, 404]).toContain(response.status);
    });

    it('should allow admin to view reports', async () => {
      const response = await request(app)
        .get('/reports/attendance')
        .set(getAuthHeaders(adminUserId, 'admin'));

      expect([200, 400]).toContain(response.status);
    });

    it('should deny admin access to superuser routes', async () => {
      const response = await request(app)
        .get('/superuser/overview')
        .set(getAuthHeaders(adminUserId, 'admin'));

      expect(response.status).toBe(403);
    });
  });

  describe('Superadmin Routes', () => {
    it('should allow superadmin to access superuser routes', async () => {
      const response = await request(app)
        .get('/superuser/overview')
        .set(getAuthHeaders(superadminUserId, 'superadmin', false)); // Superadmin doesn't need tenant

      expect([200, 404]).toContain(response.status);
    });

    it('should allow superadmin to manage schools', async () => {
      const response = await request(app)
        .get('/superuser/schools')
        .set(getAuthHeaders(superadminUserId, 'superadmin', false));

      expect([200, 404]).toContain(response.status);
    });

    it('should allow superadmin to access admin routes', async () => {
      const response = await request(app)
        .get('/students')
        .set(getAuthHeaders(superadminUserId, 'superadmin'));

      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Permission-Based Access', () => {
    it('should require attendance:manage for marking attendance', async () => {
      const response = await request(app)
        .post('/attendance/mark')
        .set(getAuthHeaders(studentUserId, 'student'))
        .send({ records: [] });

      expect(response.status).toBe(403);
    });

    it('should require users:manage for user management', async () => {
      const response = await request(app)
        .get('/users')
        .set(getAuthHeaders(teacherUserId, 'teacher'));

      expect(response.status).toBe(403);
    });

    it('should require settings:branding for branding configuration', async () => {
      const response = await request(app)
        .put('/configuration/branding')
        .set(getAuthHeaders(teacherUserId, 'teacher'))
        .send({ primaryColor: '#000' });

      expect(response.status).toBe(403);
    });

    it('should require tenants:manage for superuser routes', async () => {
      const response = await request(app)
        .get('/superuser/overview')
        .set(getAuthHeaders(adminUserId, 'admin'));

      expect(response.status).toBe(403);
    });
  });

  afterAll(async () => {
    await pool.end();
  });
});
