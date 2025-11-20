/**
 * Phase 10 - Student Approval Tests
 * 
 * Tests for student approval workflow
 */

import request from 'supertest';
import { Pool } from 'pg';
import app from '../src/app';
import { createTestPool } from './utils/testDb';
import { getPool } from '../src/db/connection';
import { hashPassword } from '../src/lib/passwordHashing';

jest.mock('../src/db/connection', () => ({
  getPool: jest.fn(),
  closePool: jest.fn()
}));

const mockedGetPool = jest.mocked(getPool);

jest.setTimeout(15000);

describe('Phase 10 - Student Approval Tests', () => {
  let pool: any;
  let tenantId: string;
  let adminUserId: string;
  let adminAccessToken: string;
  let pendingStudentId: string;

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

    // Login as admin
    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: 'admin@test.local',
        password: 'AdminPass123!'
      });
    adminAccessToken = loginResponse.body.accessToken;

    // Create pending student
    const studentPasswordHash = await hashPassword('StudentPass123!');
    const studentResult = await pool.query(
      `INSERT INTO shared.users (email, password_hash, role, tenant_id, status, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      ['pending-student@test.local', studentPasswordHash, 'student', tenantId, 'pending', false]
    );
    pendingStudentId = studentResult.rows[0].id;
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Single Student Approval', () => {
    it('should successfully approve pending student', async () => {
      const response = await request(app)
        .patch(`/users/${pendingStudentId}/approve`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('active');

      // Verify user status in database
      const userResult = await pool.query(
        `SELECT status FROM shared.users WHERE id = $1`,
        [pendingStudentId]
      );
      expect(userResult.rows[0].status).toBe('active');
    });

    it('should reject approval of already active student', async () => {
      // Create active student
      const activeStudentHash = await hashPassword('ActivePass123!');
      const activeResult = await pool.query(
        `INSERT INTO shared.users (email, password_hash, role, tenant_id, status, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        ['active-student@test.local', activeStudentHash, 'student', tenantId, 'active', true]
      );
      const activeStudentId = activeResult.rows[0].id;

      const response = await request(app)
        .patch(`/users/${activeStudentId}/approve`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send();

      expect(response.status).toBe(400);
    });

    it('should reject approval by non-admin user', async () => {
      // Create teacher user
      const teacherHash = await hashPassword('TeacherPass123!');
      const teacherResult = await pool.query(
        `INSERT INTO shared.users (email, password_hash, role, tenant_id, status, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        ['teacher@test.local', teacherHash, 'teacher', tenantId, 'active', true]
      );

      // Login as teacher
      const teacherLogin = await request(app)
        .post('/auth/login')
        .send({
          email: 'teacher@test.local',
          password: 'TeacherPass123!'
        });
      const teacherToken = teacherLogin.body.accessToken;

      // Create new pending student
      const newPendingHash = await hashPassword('NewPending123!');
      const newPendingResult = await pool.query(
        `INSERT INTO shared.users (email, password_hash, role, tenant_id, status, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        ['new-pending@test.local', newPendingHash, 'student', tenantId, 'pending', false]
      );

      const response = await request(app)
        .patch(`/users/${newPendingResult.rows[0].id}/approve`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send();

      expect(response.status).toBe(403);
    });
  });

  describe('Bulk Student Approval', () => {
    it('should successfully approve multiple students', async () => {
      // Create multiple pending students
      const studentIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const hash = await hashPassword(`BulkPass${i}123!`);
        const result = await pool.query(
          `INSERT INTO shared.users (email, password_hash, role, tenant_id, status, is_verified)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [`bulk-student-${i}@test.local`, hash, 'student', tenantId, 'pending', false]
        );
        studentIds.push(result.rows[0].id);
      }

      const response = await request(app)
        .post('/users/bulk-approve')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          userIds: studentIds
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.processed).toBe(3);
      expect(response.body.successful).toBe(3);

      // Verify all students are approved
      for (const studentId of studentIds) {
        const userResult = await pool.query(
          `SELECT status FROM shared.users WHERE id = $1`,
          [studentId]
        );
        expect(userResult.rows[0].status).toBe('active');
      }
    });

    it('should handle partial failures in bulk approval', async () => {
      // Create mix of pending and active students
      const studentIds: string[] = [];
      
      // Pending student
      const pendingHash = await hashPassword('PartialPending123!');
      const pendingResult = await pool.query(
        `INSERT INTO shared.users (email, password_hash, role, tenant_id, status, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        ['partial-pending@test.local', pendingHash, 'student', tenantId, 'pending', false]
      );
      studentIds.push(pendingResult.rows[0].id);

      // Active student (should fail)
      const activeHash = await hashPassword('PartialActive123!');
      const activeResult = await pool.query(
        `INSERT INTO shared.users (email, password_hash, role, tenant_id, status, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        ['partial-active@test.local', activeHash, 'student', tenantId, 'active', true]
      );
      studentIds.push(activeResult.rows[0].id);

      const response = await request(app)
        .post('/users/bulk-approve')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          userIds: studentIds
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.processed).toBe(2);
      expect(response.body.successful).toBe(1);
      expect(response.body.failed).toBe(1);
    });
  });

  describe('Student Rejection', () => {
    it('should successfully reject pending student', async () => {
      // Create pending student
      const rejectHash = await hashPassword('RejectPass123!');
      const rejectResult = await pool.query(
        `INSERT INTO shared.users (email, password_hash, role, tenant_id, status, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        ['reject-student@test.local', rejectHash, 'student', tenantId, 'pending', false]
      );
      const rejectStudentId = rejectResult.rows[0].id;

      const response = await request(app)
        .patch(`/users/${rejectStudentId}/reject`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          reason: 'Incomplete application'
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('rejected');

      // Verify user status in database
      const userResult = await pool.query(
        `SELECT status FROM shared.users WHERE id = $1`,
        [rejectStudentId]
      );
      expect(userResult.rows[0].status).toBe('rejected');
    });
  });
});

