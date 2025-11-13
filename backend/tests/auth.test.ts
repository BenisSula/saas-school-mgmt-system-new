import request from 'supertest';
import type { Pool } from 'pg';
import app from '../src/app';
import { createTestPool } from './utils/testDb';
import { getPool } from '../src/db/connection';

jest.mock('../src/db/connection', () => ({
  getPool: jest.fn(),
  closePool: jest.fn()
}));

const mockedGetPool = getPool as unknown as jest.Mock;

jest.setTimeout(15000);

describe('Authentication & RBAC', () => {
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

  it('allows signup, login, refresh, and access to protected route', async () => {
    const email = 'admin@testacademy.com';
    const password = 'StrongPassw0rd!';

    const signupResponse = await request(app).post('/auth/signup').send({
      email,
      password,
      role: 'admin',
      tenantId
    });

    expect(signupResponse.status).toBe(201);
    expect(signupResponse.body).toHaveProperty('accessToken');
    expect(signupResponse.body.user.role).toBe('admin');
    expect(signupResponse.body.user.tenantId).toBe(tenantId);

    const loginResponse = await request(app).post('/auth/login').send({
      email,
      password
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toHaveProperty('accessToken');
    expect(loginResponse.body).toHaveProperty('refreshToken');

    const accessToken = loginResponse.body.accessToken as string;
    const refreshToken = loginResponse.body.refreshToken as string;

    const protectedResponse = await request(app)
      .get('/admin/overview')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(protectedResponse.status).toBe(200);
    expect(protectedResponse.body.message).toContain('Welcome');

    const refreshResponse = await request(app).post('/auth/refresh').send({
      refreshToken
    });

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body).toHaveProperty('accessToken');
    expect(refreshResponse.body).toHaveProperty('refreshToken');
  });

  it('blocks users without permission from protected route', async () => {
    const email = 'student@testacademy.com';
    const password = 'StrongPassw0rd!';

    const signupResponse = await request(app).post('/auth/signup').send({
      email,
      password,
      role: 'student',
      tenantId
    });

    expect(signupResponse.status).toBe(201);

    const loginResponse = await request(app).post('/auth/login').send({
      email,
      password
    });

    expect(loginResponse.status).toBe(200);

    const studentToken = loginResponse.body.accessToken as string;

    const protectedResponse = await request(app)
      .get('/admin/overview')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(protectedResponse.status).toBe(403);
  });
});
