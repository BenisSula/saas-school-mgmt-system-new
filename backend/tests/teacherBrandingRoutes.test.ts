import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import app from '../src/app';
import { createTenant } from '../src/db/tenantManager';
import { createTestPool } from './utils/testDb';
import { getPool } from '../src/db/connection';

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
      tokenId: 'token'
    };
    next();
  }
}));

const authHeaders = { Authorization: 'Bearer fake', 'x-tenant-id': 'tenant_alpha' };

jest.mock('../src/db/connection', () => ({
  getPool: jest.fn(),
  closePool: jest.fn()
}));

const mockedGetPool = jest.mocked(getPool);

describe('Teacher and branding routes', () => {
  beforeAll(async () => {
    const testPool = await createTestPool();
    mockedGetPool.mockReturnValue(testPool.pool);
    await createTenant(
      {
        name: 'Test School',
        schemaName: 'tenant_alpha'
      },
      testPool.pool
    );
  });

  it('creates and lists teachers', async () => {
    const create = await request(app)
      .post('/teachers')
      .set(authHeaders)
      .send({
        name: 'Prof. Turing',
        email: 'turing@test.com',
        subjects: ['Mathematics']
      });

    expect(create.status).toBe(201);

    const list = await request(app).get('/teachers').set(authHeaders);
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThanOrEqual(1);
  });

  it('updates branding', async () => {
    const update = await request(app)
      .put('/branding')
      .set(authHeaders)
      .send({
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#ff0000',
        themeFlags: { darkMode: true }
      });

    expect(update.status).toBe(200);
    expect(update.body.primary_color).toBe('#ff0000');

    const get = await request(app).get('/branding').set(authHeaders);
    expect(get.status).toBe(200);
    expect(get.body.primary_color).toBe('#ff0000');
  });

  it('upserts school profile', async () => {
    const update = await request(app)
      .put('/school')
      .set(authHeaders)
      .send({
        name: 'Updated Academy',
        address: {
          line1: '123 Main St',
          city: 'Example City'
        }
      });

    expect(update.status).toBe(200);
    expect(update.body.name).toBe('Updated Academy');

    const get = await request(app).get('/school').set(authHeaders);
    expect(get.status).toBe(200);
    expect(get.body.name).toBe('Updated Academy');
  });
});
