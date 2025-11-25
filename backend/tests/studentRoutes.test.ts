import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';

type MockAuthRequest = Request & {
  user?: {
    id: string;
    role: 'admin' | 'superadmin';
    tenantId: string;
    email: string;
    tokenId: string;
  };
};

jest.mock('../src/middleware/authenticate', () => ({
  __esModule: true,
  default: (req: MockAuthRequest, _res: Response, next: NextFunction) => {
    req.user = {
      id: 'test-user',
      role: 'admin',
      tenantId: 'tenant_alpha',
      email: 'admin@test.com',
      tokenId: 'token',
    };
    next();
  },
}));

import app from '../src/app';
import { createTenant } from '../src/db/tenantManager';
import { createTestPool } from './utils/testDb';
import { getPool } from '../src/db/connection';

jest.mock('../src/db/connection', () => ({
  getPool: jest.fn(),
  closePool: jest.fn(),
}));

const mockedGetPool = jest.mocked(getPool);

describe('Student routes', () => {
  beforeAll(async () => {
    const testPool = await createTestPool();
    mockedGetPool.mockReturnValue(testPool.pool);
    await createTenant(
      {
        name: 'Test School',
        schemaName: 'tenant_alpha',
      },
      testPool.pool
    );
  });

  const authHeaders = { Authorization: 'Bearer fake', 'x-tenant-id': 'tenant_alpha' };

  it('creates and retrieves students', async () => {
    const create = await request(app).post('/students').set(authHeaders).send({
      firstName: 'Ada',
      lastName: 'Lovelace',
      admissionNumber: 'A001',
    });

    expect(create.status).toBe(201);

    const list = await request(app).get('/students').set(authHeaders);
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThanOrEqual(1);
  });
});
