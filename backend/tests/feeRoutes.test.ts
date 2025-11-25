import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import app from '../src/app';
import { createTestPool } from './utils/testDb';
import { createTenant } from '../src/db/tenantManager';
import { getPool } from '../src/db/connection';

jest.setTimeout(15000);

type MockAuthRequest = Request & {
  user?: {
    id: string;
    role: 'student' | 'admin' | 'teacher' | 'superadmin';
    tenantId: string;
    email: string;
    tokenId: string;
  };
};

jest.mock('../src/middleware/authenticate', () => ({
  __esModule: true,
  default: (req: MockAuthRequest, _res: Response, next: NextFunction) => {
    req.user = {
      id: 'admin-user',
      role: 'admin',
      tenantId: 'tenant_alpha',
      email: 'admin@test.com',
      tokenId: 'token',
    };
    next();
  },
}));

jest.mock('../src/db/connection', () => ({
  getPool: jest.fn(),
  closePool: jest.fn(),
}));

const mockedGetPool = jest.mocked(getPool);

describe('Fee management routes', () => {
  let studentId: string;
  let invoiceId: string;
  const adminHeaders = { Authorization: 'Bearer fake', 'x-tenant-id': 'tenant_alpha' };

  beforeAll(async () => {
    const { pool } = await createTestPool();
    mockedGetPool.mockReturnValue(pool);

    await createTenant(
      {
        name: 'Alpha Academy',
        schemaName: 'tenant_alpha',
      },
      pool
    );

    const studentInsert = await pool.query(
      `
        INSERT INTO tenant_alpha.students (first_name, last_name, admission_number)
        VALUES ('Ada', 'Lovelace', 'A-1001')
        RETURNING id
      `
    );
    studentId = studentInsert.rows[0].id;
  });

  it('creates an invoice with items', async () => {
    const response = await request(app)
      .post('/invoices')
      .set(adminHeaders)
      .send({
        studentId,
        dueDate: '2025-03-01T00:00:00.000Z',
        items: [
          { description: 'Tuition', amount: 80 },
          { description: 'Library', amount: 20 },
        ],
      });

    expect(response.status).toBe(201);
    invoiceId = response.body.id;
    expect(response.body.student_id).toBe(studentId);
    expect(Number(response.body.amount)).toBe(100);
  });

  it('lists invoices for a student', async () => {
    const response = await request(app).get(`/invoices/${studentId}`).set(adminHeaders);

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThanOrEqual(1);
    expect(response.body[0].items.length).toBe(2);
  });

  it('records a payment webhook and marks invoice as paid', async () => {
    const payload = {
      provider: 'mock-payments',
      type: 'payment.succeeded',
      paymentId: `pay_${invoiceId}`,
      invoiceId,
      amount: 100,
      currency: 'USD',
    };

    const webhook = await request(app)
      .post('/payments')
      .set({ 'x-tenant-id': 'tenant_alpha' })
      .send(payload);

    expect(webhook.status).toBe(200);

    const invoices = await request(app).get(`/invoices/${studentId}`).set(adminHeaders);

    expect(invoices.status).toBe(200);
    expect(invoices.body[0].status).toBe('paid');
  });
});
