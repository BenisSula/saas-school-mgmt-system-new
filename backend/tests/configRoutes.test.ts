import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import app from '../src/app';
import { createTestPool } from './utils/testDb';
import { createTenant } from '../src/db/tenantManager';
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
      id: 'admin-user',
      role: 'admin',
      tenantId: 'tenant_alpha',
      email: 'admin@test.com',
      tokenId: 'token'
    };
    next();
  }
}));

jest.mock('../src/db/connection', () => ({
  getPool: jest.fn().mockImplementation(() => {
    throw new Error('should be mocked in test');
  }),
  closePool: jest.fn()
}));

const mockedGetPool = jest.mocked(getPool);

describe('Configuration routes', () => {
  const headers = { Authorization: 'Bearer fake', 'x-tenant-id': 'tenant_alpha' };
  const mockTerms = [
    { name: 'Term 1 2025', startsOn: '2025-01-10', endsOn: '2025-04-10' },
    { name: 'Term 2 2025', startsOn: '2025-05-05', endsOn: '2025-08-20' }
  ];

  beforeAll(async () => {
    const { pool } = await createTestPool();
    mockedGetPool.mockReturnValue(pool);
    await createTenant(
      {
        name: 'Alpha Academy',
        schemaName: 'tenant_alpha'
      },
      pool
    );
  });

  it('updates branding', async () => {
    const response = await request(app)
      .put('/configuration/branding')
      .set(headers)
      .send({
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#1d4ed8',
        secondaryColor: '#0f172a',
        themeFlags: { darkMode: true },
        typography: { fontFamily: 'Inter' },
        navigation: { style: 'top', showLogo: true }
      });

    expect(response.status).toBe(200);
    expect(response.body.logo_url).toBe('https://example.com/logo.png');

    const branding = await request(app).get('/configuration/branding').set(headers);
    expect(branding.status).toBe(200);
    expect(branding.body.primary_color).toBe('#1d4ed8');
  });

  it('creates, updates, lists, and deletes academic terms and classes', async () => {
    const createdTerms = [];
    for (const termInput of mockTerms) {
      const term = await request(app).post('/configuration/terms').set(headers).send(termInput);
      expect(term.status).toBe(201);
      expect(term.body.name).toBe(termInput.name);
      createdTerms.push(term.body);
    }

    const [firstTerm] = createdTerms;
    const updatedTerm = await request(app)
      .put(`/configuration/terms/${firstTerm.id}`)
      .set(headers)
      .send({
        name: `${firstTerm.name} Updated`,
        startsOn: firstTerm.starts_on.slice(0, 10),
        endsOn: firstTerm.ends_on.slice(0, 10)
      });
    expect(updatedTerm.status).toBe(200);
    expect(updatedTerm.body.name).toContain('Updated');

    const listTerms = await request(app).get('/configuration/terms').set(headers);
    expect(listTerms.status).toBe(200);
    expect(listTerms.body.length).toBeGreaterThanOrEqual(2);

    const listClassesBefore = await request(app).get('/configuration/classes').set(headers);
    expect(listClassesBefore.status).toBe(200);

    const classResponse = await request(app).post('/configuration/classes').set(headers).send({
      name: 'Grade 10',
      description: 'Senior class'
    });

    expect(classResponse.status).toBe(201);
    expect(classResponse.body.name).toBe('Grade 10');

    const updatedClass = await request(app)
      .put(`/configuration/classes/${classResponse.body.id}`)
      .set(headers)
      .send({
        name: 'Grade 10 Updated',
        description: 'Senior class updated'
      });
    expect(updatedClass.status).toBe(200);
    expect(updatedClass.body.name).toBe('Grade 10 Updated');

    const deleteClassResponse = await request(app)
      .delete(`/configuration/classes/${classResponse.body.id}`)
      .set(headers);
    expect(deleteClassResponse.status).toBe(204);

    const deleteTermResponse = await request(app)
      .delete(`/configuration/terms/${firstTerm.id}`)
      .set(headers);
    expect(deleteTermResponse.status).toBe(204);

    const missingTermDelete = await request(app)
      .delete(`/configuration/terms/${firstTerm.id}`)
      .set(headers);
    expect(missingTermDelete.status).toBe(404);
  });
});
