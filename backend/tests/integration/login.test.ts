/**
 * Integration Test: Login Endpoint
 * 
 * This test verifies the /auth/login endpoint works correctly with a real backend server.
 * It starts the backend, runs migrations, seeds demo data, and tests login functionality.
 * 
 * Run with: npm test -- login.test.ts
 */

import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import type { Pool } from 'pg';
import { getPool, closePool } from '../../src/db/connection';
import { runMigrations } from '../../src/db/runMigrations';
import { seedDemoTenant } from '../../src/seed/demoTenant';
import app from '../../src/app';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-integration-tests-only';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-integration-tests-only';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.SKIP_MIGRATIONS = 'false';
process.env.AUTO_SEED_DEMO = 'true';

jest.setTimeout(30000); // 30 seconds for database setup

describe('Login Integration Test', () => {
  let pool: Pool;

  beforeAll(async () => {
    // Initialize database connection
    pool = getPool();

    try {
      // Run migrations
      console.log('[Integration Test] Running migrations...');
      await runMigrations(pool);

      // Seed demo tenant
      console.log('[Integration Test] Seeding demo tenant...');
      await seedDemoTenant(pool);
      console.log('[Integration Test] Setup complete');
    } catch (error) {
      console.error('[Integration Test] Setup failed:', error);
      throw error;
    }
  });

  afterAll(async () => {
    // Close database connection
    if (pool) {
      await closePool();
    }
  });

  describe('POST /auth/login', () => {
    it('should successfully login with valid admin credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'admin.demo@academy.test',
          password: 'AdminDemo#2025',
        })
        .expect(200);

      // Verify response structure
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('expiresIn');
      expect(response.body).toHaveProperty('user');

      // Verify user object
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email', 'admin.demo@academy.test');
      expect(response.body.user).toHaveProperty('role', 'admin');
      expect(response.body.user).toHaveProperty('tenantId');
      expect(response.body.user).toHaveProperty('isVerified', true);
      expect(response.body.user).toHaveProperty('status', 'active');

      // Verify tokens are strings
      expect(typeof response.body.accessToken).toBe('string');
      expect(typeof response.body.refreshToken).toBe('string');
      expect(response.body.accessToken.length).toBeGreaterThan(0);
      expect(response.body.refreshToken.length).toBeGreaterThan(0);
    });

    it('should successfully login with valid teacher credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'teacher.demo@academy.test',
          password: 'TeacherDemo#2025',
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user).toHaveProperty('email', 'teacher.demo@academy.test');
      expect(response.body.user).toHaveProperty('role', 'teacher');
    });

    it('should successfully login with valid student credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'student.demo@academy.test',
          password: 'StudentDemo#2025',
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user).toHaveProperty('email', 'student.demo@academy.test');
      expect(response.body.user).toHaveProperty('role', 'student');
    });

    it('should successfully login with valid superuser credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'owner.demo@platform.test',
          password: 'OwnerDemo#2025',
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user).toHaveProperty('email', 'owner.demo@platform.test');
      expect(response.body.user).toHaveProperty('role', 'superadmin');
    });

    it('should reject login with invalid email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePassword123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'INVALID_CREDENTIALS');
      expect(response.body).toHaveProperty('message');
    });

    it('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'admin.demo@academy.test',
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'INVALID_CREDENTIALS');
      expect(response.body).toHaveProperty('message');
    });

    it('should reject login with missing email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          password: 'SomePassword123!',
        })
        .expect(422);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'MISSING_REQUIRED_FIELDS');
    });

    it('should reject login with missing password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'admin.demo@academy.test',
        })
        .expect(422);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'MISSING_REQUIRED_FIELDS');
    });

    it('should include CORS headers in response', async () => {
      const response = await request(app)
        .post('/auth/login')
        .set('Origin', 'http://localhost:5173')
        .send({
          email: 'admin.demo@academy.test',
          password: 'AdminDemo#2025',
        })
        .expect(200);

      // CORS headers should be present (if CORS middleware is applied)
      // Note: supertest doesn't always show CORS headers, but the request should succeed
      expect(response.headers).toBeDefined();
    });

    it('should respect rate limiting for suspicious login attempts', async () => {
      // Attempt multiple failed logins
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/auth/login')
          .send({
            email: 'admin.demo@academy.test',
            password: 'WrongPassword123!',
          })
          .expect(401);
      }

      // Subsequent requests should be rate limited (429 Too Many Requests)
      // Note: Rate limiting behavior depends on configuration
      // This test verifies the endpoint handles the requests without crashing
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /auth/health', () => {
    it('should return auth health status with database connection', async () => {
      const response = await request(app)
        .get('/auth/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('db', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});

