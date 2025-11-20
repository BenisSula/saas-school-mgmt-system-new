/**
 * Phase 10 - HOD Creation Tests
 * 
 * Tests for Head of Department (HOD) creation workflow
 */

import request from 'supertest';
import { Pool } from 'pg';
import app from '../src/app';
import { createTestPool } from './utils/testDb';
import { getPool } from '../src/db/connection';
import { hashPassword } from '../src/lib/passwordHashing';
import { adminCreateUser } from '../src/services/adminUserService';
import { getTenantClient } from '../src/db/tenantManager';

jest.mock('../src/db/connection', () => ({
  getPool: jest.fn(),
  closePool: jest.fn()
}));

const mockedGetPool = jest.mocked(getPool);

jest.setTimeout(15000);

describe('Phase 10 - HOD Creation Tests', () => {
  let pool: any;
  let tenantId: string;
  let adminUserId: string;
  let adminAccessToken: string;
  let departmentId: string;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

    const testPool = await createTestPool();
    pool = testPool.pool;
    mockedGetPool.mockReturnValue(pool);

    // Create test tenant
    const tenantResult = await pool.query(
      `INSERT INTO shared.tenants (name, domain, schema_name)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['Test School', 'test.local', 'tenant_test']
    );
    tenantId = tenantResult.rows[0].id;

    // Create admin user
    const adminPasswordHash = await hashPassword('AdminPass123!');
    const adminResult = await pool.query(
      `INSERT INTO shared.users (email, password_hash, role, tenant_id, status, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      ['admin@test.local', adminPasswordHash, 'admin', tenantId, 'active', true]
    );
    adminUserId = adminResult.rows[0].id;

    // Login as admin to get access token
    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: 'admin@test.local',
        password: 'AdminPass123!'
      });
    adminAccessToken = loginResponse.body.accessToken;

    // Create department
    const deptResult = await pool.query(
      `INSERT INTO shared.departments (name, tenant_id)
       VALUES ($1, $2)
       RETURNING id`,
      ['Mathematics', tenantId]
    );
    departmentId = deptResult.rows[0].id;
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('HOD Creation via API', () => {
    it('should successfully create HOD user via API', async () => {
      const response = await request(app)
        .post('/users/register')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          email: 'hod@test.local',
          password: 'HODPass123!',
          role: 'hod',
          profile: {
            fullName: 'Head of Mathematics',
            departmentId: departmentId,
            phone: '+1234567890',
            qualifications: 'Ph.D. Mathematics',
            yearsOfExperience: 10,
            subjects: ['mathematics', 'statistics']
          }
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('userId');
      expect(response.body).toHaveProperty('profileId');
      expect(response.body.role).toBe('hod');
      expect(response.body.status).toBe('active');
    });

    it('should reject HOD creation without department', async () => {
      const response = await request(app)
        .post('/users/register')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          email: 'hod-no-dept@test.local',
          password: 'HODPass123!',
          role: 'hod',
          profile: {
            fullName: 'Head Without Department',
            phone: '+1234567890'
          }
        });

      expect(response.status).toBe(400);
    });

    it('should reject HOD creation with invalid department', async () => {
      const response = await request(app)
        .post('/users/register')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          email: 'hod-invalid-dept@test.local',
          password: 'HODPass123!',
          role: 'hod',
          profile: {
            fullName: 'Head Invalid Department',
            departmentId: 'invalid-department-id',
            phone: '+1234567890'
          }
        });

      expect(response.status).toBe(400);
    });
  });

  describe('HOD Creation via Service', () => {
    it('should successfully create HOD via adminCreateUser service', async () => {
      const tenantClient = await getTenantClient(pool, tenantId);
      const tenant = await pool.query(
        `SELECT schema_name FROM shared.tenants WHERE id = $1`,
        [tenantId]
      );
      const schemaName = tenant.rows[0].schema_name;

      const result = await adminCreateUser(
        tenantId,
        tenantClient,
        schemaName,
        {
          email: 'hod-service@test.local',
          password: 'HODPass123!',
          role: 'hod',
          fullName: 'HOD via Service',
          departmentId: departmentId,
          phone: '+1234567890',
          qualifications: 'M.Sc Mathematics',
          yearsOfExperience: 8,
          subjects: ['mathematics']
        },
        adminUserId
      );

      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('profileId');
      expect(result.role).toBe('hod');
      expect(result.status).toBe('active');

      // Verify HOD profile was created
      const profileResult = await tenantClient.query(
        `SELECT * FROM ${schemaName}.teacher_profiles WHERE user_id = $1`,
        [result.userId]
      );

      expect(profileResult.rows.length).toBe(1);
      expect(profileResult.rows[0].department_id).toBe(departmentId);

      await tenantClient.release();
    });

    it('should create HOD with correct role in users table', async () => {
      const tenantClient = await getTenantClient(pool, tenantId);
      const tenant = await pool.query(
        `SELECT schema_name FROM shared.tenants WHERE id = $1`,
        [tenantId]
      );
      const schemaName = tenant.rows[0].schema_name;

      const result = await adminCreateUser(
        tenantId,
        tenantClient,
        schemaName,
        {
          email: 'hod-role-check@test.local',
          password: 'HODPass123!',
          role: 'hod',
          fullName: 'HOD Role Check',
          departmentId: departmentId
        },
        adminUserId
      );

      // Verify user role
      const userResult = await pool.query(
        `SELECT role FROM shared.users WHERE id = $1`,
        [result.userId]
      );

      expect(userResult.rows[0].role).toBe('hod');

      await tenantClient.release();
    });
  });

  describe('HOD Profile Creation', () => {
    it('should create teacher profile for HOD', async () => {
      const tenantClient = await getTenantClient(pool, tenantId);
      const tenant = await pool.query(
        `SELECT schema_name FROM shared.tenants WHERE id = $1`,
        [tenantId]
      );
      const schemaName = tenant.rows[0].schema_name;

      const result = await adminCreateUser(
        tenantId,
        tenantClient,
        schemaName,
        {
          email: 'hod-profile@test.local',
          password: 'HODPass123!',
          role: 'hod',
          fullName: 'HOD Profile Test',
          departmentId: departmentId,
          phone: '+1234567890',
          qualifications: 'Ph.D',
          yearsOfExperience: 15
        },
        adminUserId
      );

      // Verify teacher profile exists
      const profileResult = await tenantClient.query(
        `SELECT * FROM ${schemaName}.teacher_profiles WHERE user_id = $1`,
        [result.userId]
      );

      expect(profileResult.rows.length).toBe(1);
      const profile = profileResult.rows[0];
      expect(profile.department_id).toBe(departmentId);
      expect(profile.qualifications).toBe('Ph.D');
      expect(profile.years_of_experience).toBe(15);

      await tenantClient.release();
    });
  });
});

