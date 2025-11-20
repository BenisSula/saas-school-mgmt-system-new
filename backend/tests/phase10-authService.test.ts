/**
 * Phase 10 - Auth Service Tests
 * 
 * Comprehensive tests for authentication service including:
 * - Login functionality
 * - Registration
 * - Token refresh
 * - Password reset
 * - Error handling
 */

import request from 'supertest';
import { Pool } from 'pg';
import app from '../src/app';
import { createTestPool } from './utils/testDb';
import { getPool } from '../src/db/connection';
import { hashPassword } from '../src/lib/passwordHashing';
import { generateAccessToken, generateRefreshToken, storeRefreshToken, TokenPayload } from '../src/services/tokenService';

jest.mock('../src/db/connection', () => ({
  getPool: jest.fn(),
  closePool: jest.fn()
}));

const mockedGetPool = jest.mocked(getPool);

jest.setTimeout(15000);

describe('Phase 10 - Auth Service Tests', () => {
  let pool;
  let tenantId;
  let adminUserId;
  let studentUserId;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.ACCESS_TOKEN_TTL = '900s';
    process.env.REFRESH_TOKEN_TTL = (60 * 60).toString();

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

    // Create student user (pending)
    const studentPasswordHash = await hashPassword('StudentPass123!');
    const studentResult = await pool.query(
      `INSERT INTO shared.users (email, password_hash, role, tenant_id, status, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      ['student@test.local', studentPasswordHash, 'student', tenantId, 'pending', false]
    );
    studentUserId = studentResult.rows[0].id;
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Login', () => {
    it('should successfully login with valid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'admin@test.local',
          password: 'AdminPass123!'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user).toMatchObject({
        email: 'admin@test.local',
        role: 'admin',
        status: 'active'
      });
    });

    it('should reject login with invalid email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@test.local',
          password: 'AdminPass123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'admin@test.local',
          password: 'WrongPassword123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it('should reject login for pending users', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'student@test.local',
          password: 'StudentPass123!'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('pending');
    });

    it('should reject login for suspended users', async () => {
      // Create suspended user
      const suspendedPasswordHash = await hashPassword('SuspendedPass123!');
      await pool.query(
        `INSERT INTO shared.users (email, password_hash, role, tenant_id, status, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['suspended@test.local', suspendedPasswordHash, 'student', tenantId, 'suspended', true]
      );

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'suspended@test.local',
          password: 'SuspendedPass123!'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('suspended');
    });
  });

  describe('Registration', () => {
    it('should successfully register a new admin user', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'newadmin@test.local',
          password: 'NewAdminPass123!',
          role: 'admin',
          tenantId: tenantId,
          profile: {
            fullName: 'New Admin'
          }
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user).toMatchObject({
        email: 'newadmin@test.local',
        role: 'admin'
      });
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'weakpass@test.local',
          password: 'weak',
          role: 'admin',
          tenantId: tenantId
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'invalid-email',
          password: 'ValidPass123!',
          role: 'admin',
          tenantId: tenantId
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should reject registration with duplicate email', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'admin@test.local',
          password: 'AnotherPass123!',
          role: 'admin',
          tenantId: tenantId
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('Token Refresh', () => {
    it('should successfully refresh access token', async () => {
      // First login to get tokens
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'admin@test.local',
          password: 'AdminPass123!'
        });

      const refreshToken = loginResponse.body.refreshToken;

      // Refresh token
      const refreshResponse = await request(app)
        .post('/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .send();

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body).toHaveProperty('accessToken');
      expect(refreshResponse.body).toHaveProperty('refreshToken');
    });

    it('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .set('Cookie', 'refreshToken=invalid-token')
        .send();

      expect(response.status).toBe(401);
    });

    it('should reject refresh with expired token', async () => {
      // Create expired token manually
      const payload = {
        userId: adminUserId,
        tenantId: tenantId,
        email: 'admin@test.local',
        role: 'admin'
      };

      // Set short TTL for testing
      process.env.REFRESH_TOKEN_TTL = '1';
      const { token } = generateRefreshToken(payload);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await request(app)
        .post('/auth/refresh')
        .set('Cookie', `refreshToken=${token}`)
        .send();

      expect(response.status).toBe(401);
      
      // Reset TTL
      process.env.REFRESH_TOKEN_TTL = (60 * 60).toString();
    });
  });

  describe('Password Reset', () => {
    it('should successfully request password reset', async () => {
      const response = await request(app)
        .post('/auth/request-password-reset')
        .send({
          email: 'admin@test.local'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBeDefined();
    });

    it('should handle password reset request for non-existent user gracefully', async () => {
      const response = await request(app)
        .post('/auth/request-password-reset')
        .send({
          email: 'nonexistent@test.local'
        });

      // Should return 200 to prevent email enumeration
      expect(response.status).toBe(200);
    });

    it('should successfully reset password with valid token', async () => {
      // Get reset token from database (in real scenario, this would come from email)
      const resetResult = await pool.query(
        `SELECT reset_token FROM shared.users WHERE email = $1`,
        ['admin@test.local']
      );

      if (resetResult.rows[0]?.reset_token) {
        const response = await request(app)
          .post('/auth/reset-password')
          .send({
            token: resetResult.rows[0].reset_token,
            password: 'NewPassword123!'
          });

        expect(response.status).toBe(200);
        expect(response.body.message).toBeDefined();

        // Verify new password works
        const loginResponse = await request(app)
          .post('/auth/login')
          .send({
            email: 'admin@test.local',
            password: 'NewPassword123!'
          });

        expect(loginResponse.status).toBe(200);
      }
    });

    it('should reject password reset with invalid token', async () => {
      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'NewPassword123!'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Logout', () => {
    it('should successfully logout and revoke refresh token', async () => {
      // Login first
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'admin@test.local',
          password: 'AdminPass123!'
        });

      const refreshToken = loginResponse.body.refreshToken;

      // Logout
      const logoutResponse = await request(app)
        .post('/auth/logout')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .send();

      expect(logoutResponse.status).toBe(200);

      // Verify refresh token is revoked
      const refreshResponse = await request(app)
        .post('/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .send();

      expect(refreshResponse.status).toBe(401);
    });
  });
});

