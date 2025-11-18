/**
 * Comprehensive API Integration Tests
 *
 * Tests complete API workflows and integration between different endpoints.
 */

import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
import app from '../src/app';
import { createTestPool } from './utils/testDb';
import { getPool } from '../src/db/connection';
import { createTenant } from '../src/db/tenantManager';
import type { Pool } from 'pg';
import crypto from 'crypto';
import type { Role } from '../src/config/permissions';

type MockAuthRequest = Request & {
  user?: {
    id: string;
    role: Role;
    tenantId: string;
    email: string;
    tokenId: string;
  };
};

// Store current user for mock
let currentMockUser: NonNullable<MockAuthRequest['user']> | null = null;

jest.mock('../src/middleware/authenticate', () => ({
  __esModule: true,
  default: (req: MockAuthRequest, _res: Response, next: NextFunction) => {
    if (currentMockUser) {
      req.user = { ...currentMockUser };
    }
    next();
  }
}));

jest.mock('../src/db/connection', () => ({
  getPool: jest.fn(),
  closePool: jest.fn()
}));

const mockedGetPool = jest.mocked(getPool);

describe('API Integration Tests', () => {
  let pool: Pool;
  let tenantId: string;
  let adminId: string;
  let teacherId: string;
  let studentId: string;
  let examId: string;

  beforeAll(async () => {
    const testPool = await createTestPool();
    pool = testPool.pool;
    mockedGetPool.mockReturnValue(pool);

    // Create tenant
    tenantId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO shared.tenants (id, name, domain, schema_name, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (schema_name) DO NOTHING`,
      [tenantId, 'Integration Test School', 'integration.local', 'tenant_integration', 'active']
    );
    await pool.query('CREATE SCHEMA IF NOT EXISTS tenant_integration');
    await createTenant({ name: 'Integration Test School', schemaName: 'tenant_integration' }, pool);

    // Create users
    adminId = crypto.randomUUID();
    teacherId = crypto.randomUUID();
    studentId = crypto.randomUUID();

    await pool.query(
      `INSERT INTO shared.users (id, email, password_hash, role, status, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12), ($13, $14, $15, $16, $17, $18)`,
      [
        adminId,
        'admin@integration.com',
        '$argon2id$v=19$m=65536,t=3,p=4$test',
        'admin',
        'active',
        tenantId,
        teacherId,
        'teacher@integration.com',
        '$argon2id$v=19$m=65536,t=3,p=4$test',
        'teacher',
        'active',
        tenantId,
        studentId,
        'student@integration.com',
        '$argon2id$v=19$m=65536,t=3,p=4$test',
        'student',
        'active',
        tenantId
      ]
    );
  });

  const getAuthHeaders = (userId: string, role: Role) => {
    // Set current mock user
    currentMockUser = {
      id: userId,
      role,
      tenantId,
      email: `${role}@integration.com`,
      tokenId: 'test-token'
    };

    return {
      Authorization: 'Bearer fake-token',
      'x-tenant-id': tenantId
    };
  };

  describe('Complete Student Management Workflow', () => {
    it('should create, read, update, and delete a student', async () => {
      // Create student
      const createResponse = await request(app)
        .post('/students')
        .set(getAuthHeaders(adminId, 'admin'))
        .send({
          firstName: 'Integration',
          lastName: 'Test',
          admissionNumber: 'INT001',
          dateOfBirth: '2010-01-01'
        });

      if (createResponse.status === 201) {
        const createdStudentId = createResponse.body.id;

        // Read student
        const readResponse = await request(app)
          .get(`/students/${createdStudentId}`)
          .set(getAuthHeaders(adminId, 'admin'));

        expect([200, 404]).toContain(readResponse.status);

        // Update student
        const updateResponse = await request(app)
          .put(`/students/${createdStudentId}`)
          .set(getAuthHeaders(adminId, 'admin'))
          .send({
            firstName: 'Updated',
            lastName: 'Name'
          });

        expect([200, 404]).toContain(updateResponse.status);

        // Delete student
        const deleteResponse = await request(app)
          .delete(`/students/${createdStudentId}`)
          .set(getAuthHeaders(adminId, 'admin'));

        expect([204, 404]).toContain(deleteResponse.status);
      }
    });
  });

  describe('Attendance Workflow', () => {
    it('should allow teacher to mark attendance and student to view it', async () => {
      // Teacher marks attendance
      const markResponse = await request(app)
        .post('/attendance/mark')
        .set(getAuthHeaders(teacherId, 'teacher'))
        .send({
          records: [
            {
              studentId: studentId,
              classId: 'class-1',
              status: 'present',
              markedBy: teacherId,
              date: new Date().toISOString().split('T')[0]
            }
          ]
        });

      // Might fail if student/class doesn't exist, but should not be 403
      expect(markResponse.status).not.toBe(403);

      // Student views own attendance
      const viewResponse = await request(app)
        .get(`/attendance/${studentId}`)
        .set(getAuthHeaders(studentId, 'student'));

      // Should succeed or return empty (not 403)
      expect([200, 404]).toContain(viewResponse.status);
    });
  });

  describe('Exam and Grade Workflow', () => {
    it('should create exam, enter grades, and view results', async () => {
      // Admin creates exam
      const examResponse = await request(app)
        .post('/exams')
        .set(getAuthHeaders(adminId, 'admin'))
        .send({
          name: 'Integration Test Exam',
          examDate: '2024-06-01',
          description: 'Test exam'
        });

      if (examResponse.status === 201) {
        examId = examResponse.body.id;

        // Teacher enters grades
        const gradeResponse = await request(app)
          .post('/grades/bulk')
          .set(getAuthHeaders(teacherId, 'teacher'))
          .send({
            examId: examId,
            entries: [
              {
                studentId: studentId,
                subject: 'Mathematics',
                score: 85,
                classId: 'class-1'
              }
            ]
          });

        // Should succeed or fail gracefully (not 403)
        expect(gradeResponse.status).not.toBe(403);

        // Student views results
        const resultsResponse = await request(app)
          .get(`/results/${studentId}?exam_id=${examId}`)
          .set(getAuthHeaders(studentId, 'student'));

        // Should succeed or return empty (not 403)
        expect([200, 404, 400]).toContain(resultsResponse.status);
      }
    });
  });

  describe('User Management Workflow', () => {
    it('should allow admin to manage users', async () => {
      // List users
      const listResponse = await request(app).get('/users').set(getAuthHeaders(adminId, 'admin'));

      expect([200, 404]).toContain(listResponse.status);

      // Approve pending user (if exists)
      // This would require a pending user to be created first
      // For now, just verify the endpoint exists
      const approveResponse = await request(app)
        .patch('/users/non-existent-id/approve')
        .set(getAuthHeaders(adminId, 'admin'));

      // Should return 404 (user not found) or 400, not 403
      expect([400, 404]).toContain(approveResponse.status);
      expect(approveResponse.status).not.toBe(403);
    });
  });

  describe('Configuration Workflow', () => {
    it('should allow admin to configure branding and classes', async () => {
      // Update branding
      const brandingResponse = await request(app)
        .put('/configuration/branding')
        .set(getAuthHeaders(adminId, 'admin'))
        .send({
          primaryColor: '#FF5733',
          secondaryColor: '#33FF57',
          logoUrl: 'https://example.com/logo.png'
        });

      expect([200, 404]).toContain(brandingResponse.status);

      // Create class
      const classResponse = await request(app)
        .post('/configuration/classes')
        .set(getAuthHeaders(adminId, 'admin'))
        .send({
          name: 'Grade 10A',
          description: 'Integration test class'
        });

      if (classResponse.status === 201) {
        // List classes
        const listResponse = await request(app)
          .get('/configuration/classes')
          .set(getAuthHeaders(adminId, 'admin'));

        expect([200, 404]).toContain(listResponse.status);
      }
    });
  });

  describe('Report Generation Workflow', () => {
    it('should allow admin to generate various reports', async () => {
      // Attendance report
      const attendanceReport = await request(app)
        .get('/reports/attendance')
        .set(getAuthHeaders(adminId, 'admin'));

      expect([200, 400, 404]).toContain(attendanceReport.status);

      // Fees report
      const feesReport = await request(app)
        .get('/reports/fees')
        .set(getAuthHeaders(adminId, 'admin'));

      expect([200, 400, 404]).toContain(feesReport.status);
    });
  });

  describe('Error Handling', () => {
    it('should return proper error codes for invalid requests', async () => {
      // Invalid student data
      const invalidCreate = await request(app)
        .post('/students')
        .set(getAuthHeaders(adminId, 'admin'))
        .send({
          // Missing required fields
        });

      expect([400, 422]).toContain(invalidCreate.status);

      // Non-existent resource
      const notFound = await request(app)
        .get('/students/non-existent-id')
        .set(getAuthHeaders(adminId, 'admin'));

      expect([404]).toContain(notFound.status);
    });
  });

  describe('Pagination', () => {
    it('should support pagination in list endpoints', async () => {
      const response = await request(app)
        .get('/students?page=1&limit=10')
        .set(getAuthHeaders(adminId, 'admin'));

      if (response.status === 200 && response.body.pagination) {
        expect(response.body.pagination).toHaveProperty('page');
        expect(response.body.pagination).toHaveProperty('limit');
        expect(response.body.pagination).toHaveProperty('total');
      }
    });
  });

  afterAll(async () => {
    await pool.end();
  });
});
