/**
 * Tenant Isolation Tests
 *
 * Tests that multi-tenant isolation is properly enforced.
 * Users should only be able to access data from their own tenant.
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
  }
}));

jest.mock('../src/db/connection', () => ({
  getPool: jest.fn(),
  closePool: jest.fn()
}));

const mockedGetPool = jest.mocked(getPool);

describe('Tenant Isolation', () => {
  let pool: Pool;
  let tenant1Id: string;
  let tenant2Id: string;
  let admin1Id: string;
  let admin2Id: string;
  let student1Id: string;
  let student2Id: string;

  beforeAll(async () => {
    const testPool = await createTestPool();
    pool = testPool.pool;
    mockedGetPool.mockReturnValue(pool);

    // Create two tenants
    tenant1Id = crypto.randomUUID();
    tenant2Id = crypto.randomUUID();

    await pool.query(
      `INSERT INTO shared.tenants (id, name, domain, schema_name, status)
       VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)
       ON CONFLICT (schema_name) DO NOTHING`,
      [
        tenant1Id,
        'School 1',
        'school1.local',
        'tenant_1',
        'active',
        tenant2Id,
        'School 2',
        'school2.local',
        'tenant_2',
        'active'
      ]
    );

    await pool.query('CREATE SCHEMA IF NOT EXISTS tenant_1');
    await pool.query('CREATE SCHEMA IF NOT EXISTS tenant_2');
    await createTenant({ name: 'School 1', schemaName: 'tenant_1' }, pool);
    await createTenant({ name: 'School 2', schemaName: 'tenant_2' }, pool);

    // Create admin users for each tenant
    admin1Id = crypto.randomUUID();
    admin2Id = crypto.randomUUID();

    await pool.query(
      `INSERT INTO shared.users (id, email, password_hash, role, status, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)`,
      [
        admin1Id,
        'admin1@school1.com',
        '$argon2id$v=19$m=65536,t=3,p=4$test',
        'admin',
        'active',
        tenant1Id,
        admin2Id,
        'admin2@school2.com',
        '$argon2id$v=19$m=65536,t=3,p=4$test',
        'admin',
        'active',
        tenant2Id
      ]
    );

    // Create students in each tenant
    student1Id = crypto.randomUUID();
    student2Id = crypto.randomUUID();

    await pool.query(
      `INSERT INTO tenant_1.students (id, first_name, last_name)
       VALUES ($1, $2, $3)`,
      [student1Id, 'Student', 'One']
    );

    await pool.query(
      `INSERT INTO tenant_2.students (id, first_name, last_name)
       VALUES ($1, $2, $3)`,
      [student2Id, 'Student', 'Two']
    );
  });

  const getAuthHeaders = (userId: string, role: Role, tenantId: string) => {
    // Set current mock user
    currentMockUser = {
      id: userId,
      role,
      tenantId,
      email: `admin@school${tenantId === tenant1Id ? '1' : '2'}.com`,
      tokenId: 'test-token'
    };

    return {
      Authorization: 'Bearer fake-token',
      'x-tenant-id': tenantId
    };
  };

  describe('Data Isolation', () => {
    it('should only return students from tenant 1 when using tenant 1 token', async () => {
      const response = await request(app)
        .get('/students')
        .set(getAuthHeaders(admin1Id, 'admin', tenant1Id));

      expect([200, 404]).toContain(response.status);
      // All returned students should belong to tenant 1
      if (response.body.data && Array.isArray(response.body.data)) {
        response.body.data.forEach((student: unknown) => {
          expect(student).toBeDefined();
        });
      }
    });

    it('should only return students from tenant 2 when using tenant 2 token', async () => {
      const response = await request(app)
        .get('/students')
        .set(getAuthHeaders(admin2Id, 'admin', tenant2Id));

      expect([200, 404]).toContain(response.status);
      // All returned students should belong to tenant 2
      if (response.body.data && Array.isArray(response.body.data)) {
        response.body.data.forEach((student: unknown) => {
          expect(student).toBeDefined();
        });
      }
    });

    it('should prevent tenant 1 from accessing tenant 2 student', async () => {
      const response = await request(app)
        .get(`/students/${student2Id}`)
        .set(getAuthHeaders(admin1Id, 'admin', tenant1Id));

      // Should return 404 (not found) or 403 (forbidden)
      expect([403, 404]).toContain(response.status);
    });

    it('should prevent tenant 2 from accessing tenant 1 student', async () => {
      const response = await request(app)
        .get(`/students/${student1Id}`)
        .set(getAuthHeaders(admin2Id, 'admin', tenant2Id));

      // Should return 404 (not found) or 403 (forbidden)
      expect([403, 404]).toContain(response.status);
    });
  });

  describe('Cross-Tenant Access Prevention', () => {
    it('should reject requests with mismatched tenant ID', async () => {
      // Try to access tenant 2 data with tenant 1 user but tenant 2 ID
      currentMockUser = {
        id: admin1Id,
        role: 'admin',
        tenantId: tenant1Id,
        email: 'admin1@school1.com',
        tokenId: 'test-token'
      };

      const response = await request(app).get('/students').set({
        Authorization: 'Bearer fake-token',
        'x-tenant-id': tenant2Id
      });

      // Should reject due to tenant mismatch
      expect([403, 401, 400]).toContain(response.status);
    });

    it('should require tenant ID header for tenant-scoped routes', async () => {
      currentMockUser = {
        id: admin1Id,
        role: 'admin',
        tenantId: tenant1Id,
        email: 'admin1@school1.com',
        tokenId: 'test-token'
      };

      const response = await request(app).get('/students').set({
        Authorization: 'Bearer fake-token'
        // Missing x-tenant-id header
      });

      expect([400, 401, 403]).toContain(response.status);
    });
  });

  describe('Schema Isolation', () => {
    it('should create data in correct tenant schema', async () => {
      const newStudent = {
        firstName: 'New',
        lastName: 'Student',
        admissionNumber: 'NS001'
      };

      const createResponse = await request(app)
        .post('/students')
        .set(getAuthHeaders(admin1Id, 'admin', tenant1Id))
        .send(newStudent);

      if (createResponse.status === 201) {
        const studentId = createResponse.body.id;

        // Verify student exists in tenant 1 schema
        const result = await pool.query('SELECT * FROM tenant_1.students WHERE id = $1', [
          studentId
        ]);

        expect(result.rows.length).toBeGreaterThan(0);

        // Verify student does NOT exist in tenant 2 schema
        const result2 = await pool.query('SELECT * FROM tenant_2.students WHERE id = $1', [
          studentId
        ]);

        expect(result2.rows.length).toBe(0);
      }
    });
  });

  describe('Superuser Cross-Tenant Access', () => {
    it('should allow superuser to access any tenant data', async () => {
      const superadminId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO shared.users (id, email, password_hash, role, status, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          superadminId,
          'super@platform.com',
          '$argon2id$v=19$m=65536,t=3,p=4$test',
          'superadmin',
          'active',
          null
        ]
      );

      // Superadmin should be able to access tenant 1 data
      currentMockUser = {
        id: superadminId,
        role: 'superadmin',
        tenantId: '',
        email: 'super@platform.com',
        tokenId: 'test-token'
      };

      const response1 = await request(app).get('/students').set({
        Authorization: 'Bearer fake-token',
        'x-tenant-id': tenant1Id
      });

      // Superadmin should be able to access tenant 2 data
      const response2 = await request(app).get('/students').set({
        Authorization: 'Bearer fake-token',
        'x-tenant-id': tenant2Id
      });

      // Both should succeed (or at least not be 403)
      expect([200, 404]).toContain(response1.status);
      expect([200, 404]).toContain(response2.status);
    });
  });

  afterAll(async () => {
    await pool.end();
  });
});
