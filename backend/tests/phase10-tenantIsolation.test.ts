/**
 * Phase 10 - Tenant Isolation Tests
 * 
 * Comprehensive tests for tenant isolation enforcement
 */

import request from 'supertest';
import { Pool } from 'pg';
import app from '../src/app';
import { createTestPool } from './utils/testDb';
import { getPool } from '../src/db/connection';
import { hashPassword } from '../src/lib/passwordHashing';
import { generateAccessToken } from '../src/services/tokenService';
import type { TokenPayload } from '../src/services/tokenService';

jest.mock('../src/db/connection', () => ({
  getPool: jest.fn(),
  closePool: jest.fn()
}));

const mockedGetPool = jest.mocked(getPool);

jest.setTimeout(15000);

describe('Phase 10 - Tenant Isolation Tests', () => {
  let pool: any;
  let tenant1Id: string;
  let tenant2Id: string;
  let tenant1AdminId: string;
  let tenant2AdminId: string;
  let tenant1StudentId: string;
  let tenant2StudentId: string;
  let tenant1AdminToken: string;
  let tenant2AdminToken: string;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

    const testPool = await createTestPool();
    pool = testPool.pool;
    mockedGetPool.mockReturnValue(pool);

    // Create two tenants
    const tenant1Result = await pool.query(
      `INSERT INTO shared.tenants (name, domain, schema_name)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['School 1', 'school1.local', 'tenant_school1']
    );
    tenant1Id = tenant1Result.rows[0].id;

    const tenant2Result = await pool.query(
      `INSERT INTO shared.tenants (name, domain, schema_name)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['School 2', 'school2.local', 'tenant_school2']
    );
    tenant2Id = tenant2Result.rows[0].id;

    // Create admin for tenant 1
    const admin1Hash = await hashPassword('Admin1Pass123!');
    const admin1Result = await pool.query(
      `INSERT INTO shared.users (email, password_hash, role, tenant_id, status, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      ['admin1@school1.local', admin1Hash, 'admin', tenant1Id, 'active', true]
    );
    tenant1AdminId = admin1Result.rows[0].id;

    // Create admin for tenant 2
    const admin2Hash = await hashPassword('Admin2Pass123!');
    const admin2Result = await pool.query(
      `INSERT INTO shared.users (email, password_hash, role, tenant_id, status, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      ['admin2@school2.local', admin2Hash, 'admin', tenant2Id, 'active', true]
    );
    tenant2AdminId = admin2Result.rows[0].id;

    // Create student for tenant 1
    const student1Hash = await hashPassword('Student1Pass123!');
    const student1Result = await pool.query(
      `INSERT INTO shared.users (email, password_hash, role, tenant_id, status, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      ['student1@school1.local', student1Hash, 'student', tenant1Id, 'active', true]
    );
    tenant1StudentId = student1Result.rows[0].id;

    // Create student for tenant 2
    const student2Hash = await hashPassword('Student2Pass123!');
    const student2Result = await pool.query(
      `INSERT INTO shared.users (email, password_hash, role, tenant_id, status, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      ['student2@school2.local', student2Hash, 'student', tenant2Id, 'active', true]
    );
    tenant2StudentId = student2Result.rows[0].id;

    // Generate tokens
    const payload1: TokenPayload = {
      userId: tenant1AdminId,
      tenantId: tenant1Id,
      email: 'admin1@school1.local',
      role: 'admin'
    };
    tenant1AdminToken = generateAccessToken(payload1);

    const payload2: TokenPayload = {
      userId: tenant2AdminId,
      tenantId: tenant2Id,
      email: 'admin2@school2.local',
      role: 'admin'
    };
    tenant2AdminToken = generateAccessToken(payload2);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('User Access Isolation', () => {
    it('should allow admin to access own tenant users', async () => {
      const response = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${tenant1AdminToken}`)
        .send();

      expect(response.status).toBe(200);
      // Should only see tenant 1 users
      const users = Array.isArray(response.body) ? response.body : response.body.data || [];
      const allFromTenant1 = users.every((user: any) => user.tenantId === tenant1Id);
      expect(allFromTenant1).toBe(true);
    });

    it('should prevent admin from accessing other tenant users', async () => {
      // Try to access tenant 2's student with tenant 1's token
      const response = await request(app)
        .get(`/users/${tenant2StudentId}`)
        .set('Authorization', `Bearer ${tenant1AdminToken}`)
        .send();

      expect(response.status).toBe(403);
    });

    it('should prevent admin from modifying other tenant users', async () => {
      const response = await request(app)
        .patch(`/users/${tenant2StudentId}/role`)
        .set('Authorization', `Bearer ${tenant1AdminToken}`)
        .send({
          role: 'teacher'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('Data Isolation', () => {
    it('should isolate student data by tenant', async () => {
      // Create student records in tenant schemas
      const tenant1 = await pool.query(
        `SELECT schema_name FROM shared.tenants WHERE id = $1`,
        [tenant1Id]
      );
      const schema1 = tenant1.rows[0].schema_name;

      const tenant2 = await pool.query(
        `SELECT schema_name FROM shared.tenants WHERE id = $1`,
        [tenant2Id]
      );
      const schema2 = tenant2.rows[0].schema_name;

      // Note: This test assumes tenant schemas exist
      // In real scenario, we'd use tenant client with proper isolation
      
      // Admin from tenant 1 should only see tenant 1 students
      const response = await request(app)
        .get('/students')
        .set('Authorization', `Bearer ${tenant1AdminToken}`)
        .send();

      expect(response.status).toBe(200);
      // Verify response only contains tenant 1 data
      const students = Array.isArray(response.body) ? response.body : response.body.data || [];
      const allFromTenant1 = students.every((student: any) => {
        // Check if student belongs to tenant 1
        return student.tenantId === tenant1Id || !student.tenantId;
      });
      expect(allFromTenant1).toBe(true);
    });
  });

  describe('Cross-Tenant Access Prevention', () => {
    it('should prevent admin from creating users in other tenant', async () => {
      // Try to create user with tenant 2 ID using tenant 1 token
      const response = await request(app)
        .post('/users/register')
        .set('Authorization', `Bearer ${tenant1AdminToken}`)
        .send({
          email: 'cross-tenant@school2.local',
          password: 'CrossPass123!',
          role: 'student',
          tenantId: tenant2Id, // Wrong tenant ID
          profile: {
            fullName: 'Cross Tenant User'
          }
        });

      // Should reject or auto-correct to tenant 1
      expect([400, 403]).toContain(response.status);
    });

    it('should enforce tenant context from JWT', async () => {
      // Token contains tenant1Id, so operations should be scoped to tenant1
      const response = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${tenant1AdminToken}`)
        .send();

      expect(response.status).toBe(200);
      const users = Array.isArray(response.body) ? response.body : response.body.data || [];
      
      // All users should belong to tenant 1
      users.forEach((user: any) => {
        expect(user.tenantId).toBe(tenant1Id);
      });
    });
  });

  describe('Superuser Isolation', () => {
    it('should allow superuser to access all tenants', async () => {
      // Create superuser
      const superuserHash = await hashPassword('SuperPass123!');
      const superuserResult = await pool.query(
        `INSERT INTO shared.users (email, password_hash, role, tenant_id, status, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        ['superuser@test.local', superuserHash, 'superadmin', null, 'active', true]
      );
      const superuserId = superuserResult.rows[0].id;

      const superuserPayload: TokenPayload = {
        userId: superuserId,
        tenantId: null,
        email: 'superuser@test.local',
        role: 'superadmin'
      };
      const superuserToken = generateAccessToken(superuserPayload);

      const response = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${superuserToken}`)
        .send();

      expect(response.status).toBe(200);
      // Superuser should see users from both tenants
      const users = Array.isArray(response.body) ? response.body : response.body.data || [];
      expect(users.length).toBeGreaterThan(0);
    });

    it('should prevent superuser from accessing tenant private data without context', async () => {
      const superuserHash = await hashPassword('SuperPass2_123!');
      const superuserResult = await pool.query(
        `INSERT INTO shared.users (email, password_hash, role, tenant_id, status, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        ['superuser2@test.local', superuserHash, 'superadmin', null, 'active', true]
      );
      const superuserId = superuserResult.rows[0].id;

      const superuserPayload: TokenPayload = {
        userId: superuserId,
        tenantId: null,
        email: 'superuser2@test.local',
        role: 'superadmin'
      };
      const superuserToken = generateAccessToken(superuserPayload);

      // Superuser without tenant context should not access tenant-specific routes
      const response = await request(app)
        .get('/students')
        .set('Authorization', `Bearer ${superuserToken}`)
        .send();

      // Should require tenant context
      expect([400, 403]).toContain(response.status);
    });
  });
});

