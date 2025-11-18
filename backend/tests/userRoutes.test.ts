import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import app from '../src/app';
import { createTestPool } from './utils/testDb';
import { createTenant } from '../src/db/tenantManager';
import { getPool } from '../src/db/connection';

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    role: string;
    tenantId: string;
    email: string;
    tokenId: string;
  };
};

// Mock user ID - use a valid UUID for superadmin
const mockSuperAdminId = randomUUID();
jest.mock('../src/middleware/authenticate', () => ({
  __esModule: true,
  default: (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    req.user = {
      id: mockSuperAdminId,
      role: 'superadmin',
      tenantId: 'tenant_alpha',
      email: 'super@test.com',
      tokenId: 'token'
    };
    next();
  }
}));

jest.mock('../src/db/connection', () => ({
  getPool: jest.fn(),
  closePool: jest.fn()
}));

const mockedGetPool = jest.mocked(getPool);

describe('User management routes', () => {
  let headers: { Authorization: string; 'x-tenant-id': string };
  let tenantId: string;
  let targetUserId: string;

  beforeAll(async () => {
    const { pool } = await createTestPool();
    mockedGetPool.mockReturnValue(pool);

    const tenant = await createTenant(
      {
        name: 'Alpha Academy',
        schemaName: 'tenant_alpha'
      },
      pool
    );
    tenantId = tenant.id;
    // Use schema name in header (tenantResolver can find by ID or schema_name)
    // Using schema name is more reliable in tests
    headers = { Authorization: 'Bearer fake', 'x-tenant-id': 'tenant_alpha' };

    // Create superadmin user for the mock (required for authentication)
    await pool.query(
      `
        INSERT INTO shared.users (id, email, password_hash, role, tenant_id, is_verified, status)
        VALUES ($1, 'super@test.com', 'hash', 'superadmin', $2, true, 'active')
        ON CONFLICT (email) DO UPDATE SET id = EXCLUDED.id
      `,
      [mockSuperAdminId, tenantId]
    );

    targetUserId = randomUUID();
    await pool.query(
      `
        INSERT INTO shared.users (id, email, password_hash, role, tenant_id, is_verified, status)
        VALUES ($1, 'teacher@test.com', 'hash', 'teacher', $2, true, 'active')
      `,
      [targetUserId, tenantId]
    );
  });

  it('lists tenant users', async () => {
    const response = await request(app).get('/users').set(headers);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: targetUserId,
          email: 'teacher@test.com',
          role: 'teacher'
        })
      ])
    );
  });

  it('updates a user role', async () => {
    const response = await request(app)
      .patch(`/users/${targetUserId}/role`)
      .set(headers)
      .send({ role: 'admin' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: targetUserId,
      role: 'admin'
    });

    const listAfter = await request(app).get('/users').set(headers);
    const updated = (listAfter.body as Array<{ id: string; role: string }>).find(
      (user) => user.id === targetUserId
    );
    expect(updated).toBeDefined();
    expect(updated?.role).toBe('admin');
  });
});
