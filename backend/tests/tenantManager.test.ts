import express from 'express';
import request from 'supertest';
import type { Pool } from 'pg';
import { createTestPool } from './utils/testDb';
import { createTenant } from '../src/db/tenantManager';
import { getPool } from '../src/db/connection';
import tenantResolver from '../src/middleware/tenantResolver';

jest.mock('../src/db/connection', () => ({
  getPool: jest.fn(),
  closePool: jest.fn()
}));

const mockedGetPool = getPool as unknown as jest.Mock;

describe('tenantManager', () => {
  let pool: Pool;

  beforeEach(async () => {
    const testPool = await createTestPool();
    pool = testPool.pool;
    mockedGetPool.mockReturnValue(pool);
  });

  afterEach(() => {
    mockedGetPool.mockReset();
  });

  it('creates a tenant record in shared schema', async () => {
    const tenant = await createTenant(
      {
        name: 'Alpha Academy',
        domain: 'alpha.local',
        schemaName: 'tenant_alpha'
      },
      pool
    );

    const sharedResult = await pool.query(
      `SELECT schema_name, name FROM shared.tenants WHERE id = $1`,
      [tenant.id]
    );

    expect(sharedResult.rowCount).toBe(1);
    expect(sharedResult.rows[0].schema_name).toBe('tenant_alpha');
    expect(sharedResult.rows[0].name).toBe('Alpha Academy');
  });
});

describe('tenantResolver middleware', () => {
  afterEach(() => {
    mockedGetPool.mockReset();
  });

  it('resolves tenant via header and scopes queries', async () => {
    const mockClient = {
      query: jest
        .fn()
        // First call: SET search_path
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        // Second call: SELECT COUNT(*) FROM students
        .mockResolvedValueOnce({ rows: [{ count: 1 }], rowCount: 1 })
        // Third call: SET search_path TO public during cleanup
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }),
      release: jest.fn()
    };

    const mockPool = {
      query: jest.fn().mockResolvedValue({
        rowCount: 1,
        rows: [{ id: 'tenant-id', schema_name: 'tenant_alpha', name: 'Alpha Academy' }]
      }),
      connect: jest.fn().mockResolvedValue(mockClient)
    };

    mockedGetPool.mockReturnValue(mockPool as unknown as Pool);

    const app = express();
    app.get(
      '/students/count',
      tenantResolver(),
      async (req, res) => {
        if (!req.tenantClient) {
          return res.status(500).json({ message: 'tenant client missing' });
        }

        const result = await req.tenantClient.query(
          `SELECT COUNT(*)::int AS count FROM students`
        );

        return res.json({ tenant: req.tenant, count: result.rows[0].count });
      }
    );

    const response = await request(app)
      .get('/students/count')
      .set('x-tenant-id', 'tenant_alpha');

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
    expect(response.body.tenant.schema).toBe('tenant_alpha');

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM shared.tenants'),
      ['tenant_alpha']
    );
    expect(mockClient.query).toHaveBeenNthCalledWith(1, 'SET search_path TO tenant_alpha, public');
    expect(mockClient.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('SELECT COUNT(*)::int AS count FROM students')
    );
    expect(mockClient.query).toHaveBeenNthCalledWith(3, 'SET search_path TO public');
    expect(mockClient.release).toHaveBeenCalled();
  });
});

