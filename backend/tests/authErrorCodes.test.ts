import request from 'supertest';
import type { Pool } from 'pg';
import app from '../src/app';
import { createTestPool } from './utils/testDb';
import { getPool } from '../src/db/connection';
import argon2 from 'argon2';

jest.mock('../src/db/connection', () => ({
  getPool: jest.fn(),
  closePool: jest.fn(),
}));

const mockedGetPool = jest.mocked(getPool);

jest.setTimeout(15000);

describe('Auth Error Codes - PHASE 3', () => {
  let pool: Pool;
  let tenantId: string;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.ACCESS_TOKEN_TTL = '900s';
    process.env.REFRESH_TOKEN_TTL = (60 * 60).toString();

    const testPool = await createTestPool();
    pool = testPool.pool;
    mockedGetPool.mockReturnValue(pool);

    const tenantResult = await pool.query(
      `
        INSERT INTO shared.tenants (name, domain, schema_name)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      ['Test Academy', 'test.local', 'tenant_test']
    );

    tenantId = tenantResult.rows[0].id;
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('INVALID_CREDENTIALS (401)', () => {
    it('should return 401 with INVALID_CREDENTIALS code for wrong password', async () => {
      const email = 'test@example.com';
      const password = 'CorrectPassword123!';

      // Create a user first
      const passwordHash = await argon2.hash(password);
      await pool.query(
        `
          INSERT INTO shared.users (email, password_hash, role, tenant_id, is_verified, status)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [email, passwordHash, 'student', tenantId, true, 'active']
      );

      // Try login with wrong password
      const response = await request(app).post('/auth/login').send({
        email,
        password: 'WrongPassword123!',
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('code', 'INVALID_CREDENTIALS');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Invalid email or password');
    });

    it('should return 401 with INVALID_CREDENTIALS code for non-existent user', async () => {
      const response = await request(app).post('/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'SomePassword123!',
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('code', 'INVALID_CREDENTIALS');
    });
  });

  describe('ACCOUNT_PENDING (403)', () => {
    it('should return 403 with ACCOUNT_PENDING code for pending account', async () => {
      const email = 'pending@example.com';
      const password = 'Password123!';

      const passwordHash = await argon2.hash(password);
      await pool.query(
        `
          INSERT INTO shared.users (email, password_hash, role, tenant_id, is_verified, status)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [email, passwordHash, 'student', tenantId, true, 'pending']
      );

      const response = await request(app).post('/auth/login').send({
        email,
        password,
      });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('code', 'ACCOUNT_PENDING');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('pending approval');
    });

    it('should return 403 with ACCOUNT_PENDING code for rejected account', async () => {
      const email = 'rejected@example.com';
      const password = 'Password123!';

      const passwordHash = await argon2.hash(password);
      await pool.query(
        `
          INSERT INTO shared.users (email, password_hash, role, tenant_id, is_verified, status)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [email, passwordHash, 'student', tenantId, true, 'rejected']
      );

      const response = await request(app).post('/auth/login').send({
        email,
        password,
      });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('code', 'ACCOUNT_PENDING');
    });
  });

  describe('ACCOUNT_SUSPENDED (403)', () => {
    it('should return 403 with ACCOUNT_SUSPENDED code for suspended account', async () => {
      const email = 'suspended@example.com';
      const password = 'Password123!';

      const passwordHash = await argon2.hash(password);
      await pool.query(
        `
          INSERT INTO shared.users (email, password_hash, role, tenant_id, is_verified, status)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [email, passwordHash, 'student', tenantId, true, 'suspended']
      );

      const response = await request(app).post('/auth/login').send({
        email,
        password,
      });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('code', 'ACCOUNT_SUSPENDED');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('suspended');
    });
  });

  describe('EMAIL_UNVERIFIED (403)', () => {
    it('should return 403 with EMAIL_UNVERIFIED code for unverified email', async () => {
      const email = 'unverified@example.com';
      const password = 'Password123!';

      const passwordHash = await argon2.hash(password);
      await pool.query(
        `
          INSERT INTO shared.users (email, password_hash, role, tenant_id, is_verified, status)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [email, passwordHash, 'student', tenantId, false, 'active']
      );

      const response = await request(app).post('/auth/login').send({
        email,
        password,
      });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('code', 'EMAIL_UNVERIFIED');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('verify your email');
    });
  });

  describe('Successful login (200)', () => {
    it('should return 200 with tokens for valid active verified account', async () => {
      const email = 'active@example.com';
      const password = 'Password123!';

      const passwordHash = await argon2.hash(password);
      await pool.query(
        `
          INSERT INTO shared.users (email, password_hash, role, tenant_id, is_verified, status)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [email, passwordHash, 'student', tenantId, true, 'active']
      );

      const response = await request(app).post('/auth/login').send({
        email,
        password,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.status).toBe('active');
      expect(response.body.user.isVerified).toBe(true);
    });
  });
});
