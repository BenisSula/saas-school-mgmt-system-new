#!/usr/bin/env node

/**
 * Generate Postman Collection and API Documentation
 * This script creates a comprehensive Postman collection from the OpenAPI spec
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001';
const API_VERSION = '1.0.0';

// Postman Collection Structure
const postmanCollection = {
  info: {
    name: 'SaaS School Management API',
    description: 'Complete REST API collection for the SaaS School Management System',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    _exporter_id: 'saas-school-api',
    version: API_VERSION,
  },
  auth: {
    type: 'bearer',
    bearer: [
      {
        key: 'token',
        value: '{{accessToken}}',
        type: 'string',
      },
    ],
  },
  variable: [
    {
      key: 'baseUrl',
      value: BASE_URL,
      type: 'string',
    },
    {
      key: 'accessToken',
      value: '',
      type: 'string',
    },
    {
      key: 'refreshToken',
      value: '',
      type: 'string',
    },
    {
      key: 'tenantId',
      value: '',
      type: 'string',
    },
  ],
  item: [
    // Authentication Folder
    {
      name: 'Authentication',
      item: [
        {
          name: 'Login',
          event: [
            {
              listen: 'test',
              script: {
                exec: [
                  "if (pm.response.code === 200) {",
                  "    const jsonData = pm.response.json();",
                  "    pm.collectionVariables.set('accessToken', jsonData.accessToken);",
                  "    pm.collectionVariables.set('refreshToken', jsonData.refreshToken);",
                  "    pm.collectionVariables.set('tenantId', jsonData.user.tenantId);",
                  "}",
                ],
                type: 'text/javascript',
              },
            },
          ],
          request: {
            method: 'POST',
            header: [
              {
                key: 'Content-Type',
                value: 'application/json',
              },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify(
                {
                  email: 'admin@example.com',
                  password: 'password123',
                  tenantId: '{{tenantId}}',
                },
                null,
                2
              ),
            },
            url: {
              raw: '{{baseUrl}}/auth/login',
              host: ['{{baseUrl}}'],
              path: ['auth', 'login'],
            },
            description: 'Authenticate user and receive access/refresh tokens',
          },
        },
        {
          name: 'Register',
          request: {
            method: 'POST',
            header: [
              {
                key: 'Content-Type',
                value: 'application/json',
              },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify(
                {
                  email: 'newuser@example.com',
                  password: 'SecurePass123!',
                  role: 'student',
                  tenantId: '{{tenantId}}',
                  profile: {},
                },
                null,
                2
              ),
            },
            url: {
              raw: '{{baseUrl}}/auth/signup',
              host: ['{{baseUrl}}'],
              path: ['auth', 'signup'],
            },
            description: 'Register a new user account',
          },
        },
        {
          name: 'Refresh Token',
          request: {
            method: 'POST',
            header: [
              {
                key: 'Content-Type',
                value: 'application/json',
              },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify(
                {
                  refreshToken: '{{refreshToken}}',
                },
                null,
                2
              ),
            },
            url: {
              raw: '{{baseUrl}}/auth/refresh',
              host: ['{{baseUrl}}'],
              path: ['auth', 'refresh'],
            },
            description: 'Get new access token using refresh token',
          },
        },
        {
          name: 'Logout',
          request: {
            method: 'POST',
            header: [
              {
                key: 'Authorization',
                value: 'Bearer {{accessToken}}',
              },
            ],
            url: {
              raw: '{{baseUrl}}/auth/logout',
              host: ['{{baseUrl}}'],
              path: ['auth', 'logout'],
            },
            description: 'Logout user and invalidate tokens',
          },
        },
        {
          name: 'Request Password Reset',
          request: {
            method: 'POST',
            header: [
              {
                key: 'Content-Type',
                value: 'application/json',
              },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify(
                {
                  email: 'user@example.com',
                },
                null,
                2
              ),
            },
            url: {
              raw: '{{baseUrl}}/auth/reset-password/request',
              host: ['{{baseUrl}}'],
              path: ['auth', 'reset-password', 'request'],
            },
            description: 'Request password reset email',
          },
        },
        {
          name: 'Reset Password',
          request: {
            method: 'POST',
            header: [
              {
                key: 'Content-Type',
                value: 'application/json',
              },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify(
                {
                  token: 'reset-token-from-email',
                  newPassword: 'NewSecurePass123!',
                },
                null,
                2
              ),
            },
            url: {
              raw: '{{baseUrl}}/auth/reset-password',
              host: ['{{baseUrl}}'],
              path: ['auth', 'reset-password'],
            },
            description: 'Reset password with token from email',
          },
        },
        {
          name: 'Request Email Verification',
          request: {
            method: 'POST',
            header: [
              {
                key: 'Authorization',
                value: 'Bearer {{accessToken}}',
              },
              {
                key: 'Content-Type',
                value: 'application/json',
              },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify(
                {
                  email: 'user@example.com',
                },
                null,
                2
              ),
            },
            url: {
              raw: '{{baseUrl}}/auth/verify-email',
              host: ['{{baseUrl}}'],
              path: ['auth', 'verify-email'],
            },
            description: 'Request email verification',
          },
        },
        {
          name: 'Verify Email',
          request: {
            method: 'POST',
            header: [
              {
                key: 'Content-Type',
                value: 'application/json',
              },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify(
                {
                  token: 'verification-token-from-email',
                },
                null,
                2
              ),
            },
            url: {
              raw: '{{baseUrl}}/auth/verify-email/confirm',
              host: ['{{baseUrl}}'],
              path: ['auth', 'verify-email', 'confirm'],
            },
            description: 'Verify email with token',
          },
        },
      ],
    },
    // Health Check
    {
      name: 'Health Check',
      request: {
        method: 'GET',
        header: [],
        url: {
          raw: '{{baseUrl}}/health',
          host: ['{{baseUrl}}'],
          path: ['health'],
        },
        description: 'Check API health status',
      },
    },
    // Students Folder
    {
      name: 'Students',
      item: [
        {
          name: 'List Students',
          request: {
            method: 'GET',
            header: [
              {
                key: 'Authorization',
                value: 'Bearer {{accessToken}}',
              },
              {
                key: 'x-tenant-id',
                value: '{{tenantId}}',
              },
            ],
            url: {
              raw: '{{baseUrl}}/students?page=1&limit=20',
              host: ['{{baseUrl}}'],
              path: ['students'],
              query: [
                { key: 'page', value: '1' },
                { key: 'limit', value: '20' },
                { key: 'classId', value: '', disabled: true },
              ],
            },
            description: 'Get paginated list of students',
          },
        },
        {
          name: 'Get Student',
          request: {
            method: 'GET',
            header: [
              {
                key: 'Authorization',
                value: 'Bearer {{accessToken}}',
              },
              {
                key: 'x-tenant-id',
                value: '{{tenantId}}',
              },
            ],
            url: {
              raw: '{{baseUrl}}/students/:id',
              host: ['{{baseUrl}}'],
              path: ['students', ':id'],
              variable: [{ key: 'id', value: '' }],
            },
            description: 'Get student by ID',
          },
        },
        {
          name: 'Create Student',
          request: {
            method: 'POST',
            header: [
              {
                key: 'Authorization',
                value: 'Bearer {{accessToken}}',
              },
              {
                key: 'x-tenant-id',
                value: '{{tenantId}}',
              },
              {
                key: 'Content-Type',
                value: 'application/json',
              },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify(
                {
                  firstName: 'John',
                  lastName: 'Doe',
                  dateOfBirth: '2010-01-15',
                  classId: 'class-uuid',
                  admissionNumber: 'ADM001',
                  parentContacts: [
                    {
                      name: 'Jane Doe',
                      relationship: 'mother',
                      phone: '+1234567890',
                    },
                  ],
                },
                null,
                2
              ),
            },
            url: {
              raw: '{{baseUrl}}/students',
              host: ['{{baseUrl}}'],
              path: ['students'],
            },
            description: 'Create a new student',
          },
        },
        {
          name: 'Update Student',
          request: {
            method: 'PUT',
            header: [
              {
                key: 'Authorization',
                value: 'Bearer {{accessToken}}',
              },
              {
                key: 'x-tenant-id',
                value: '{{tenantId}}',
              },
              {
                key: 'Content-Type',
                value: 'application/json',
              },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify(
                {
                  firstName: 'John',
                  lastName: 'Doe Updated',
                },
                null,
                2
              ),
            },
            url: {
              raw: '{{baseUrl}}/students/:id',
              host: ['{{baseUrl}}'],
              path: ['students', ':id'],
              variable: [{ key: 'id', value: '' }],
            },
            description: 'Update student information',
          },
        },
        {
          name: 'Delete Student',
          request: {
            method: 'DELETE',
            header: [
              {
                key: 'Authorization',
                value: 'Bearer {{accessToken}}',
              },
              {
                key: 'x-tenant-id',
                value: '{{tenantId}}',
              },
            ],
            url: {
              raw: '{{baseUrl}}/students/:id',
              host: ['{{baseUrl}}'],
              path: ['students', ':id'],
              variable: [{ key: 'id', value: '' }],
            },
            description: 'Delete a student',
          },
        },
      ],
    },
    // Teachers Folder
    {
      name: 'Teachers',
      item: [
        {
          name: 'List Teachers',
          request: {
            method: 'GET',
            header: [
              {
                key: 'Authorization',
                value: 'Bearer {{accessToken}}',
              },
              {
                key: 'x-tenant-id',
                value: '{{tenantId}}',
              },
            ],
            url: {
              raw: '{{baseUrl}}/teachers?page=1&limit=20',
              host: ['{{baseUrl}}'],
              path: ['teachers'],
              query: [
                { key: 'page', value: '1' },
                { key: 'limit', value: '20' },
              ],
            },
            description: 'Get paginated list of teachers',
          },
        },
        {
          name: 'Get Teacher',
          request: {
            method: 'GET',
            header: [
              {
                key: 'Authorization',
                value: 'Bearer {{accessToken}}',
              },
              {
                key: 'x-tenant-id',
                value: '{{tenantId}}',
              },
            ],
            url: {
              raw: '{{baseUrl}}/teachers/:id',
              host: ['{{baseUrl}}'],
              path: ['teachers', ':id'],
              variable: [{ key: 'id', value: '' }],
            },
            description: 'Get teacher by ID',
          },
        },
        {
          name: 'Create Teacher',
          request: {
            method: 'POST',
            header: [
              {
                key: 'Authorization',
                value: 'Bearer {{accessToken}}',
              },
              {
                key: 'x-tenant-id',
                value: '{{tenantId}}',
              },
              {
                key: 'Content-Type',
                value: 'application/json',
              },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify(
                {
                  name: 'Jane Smith',
                  email: 'jane.smith@example.com',
                  subjects: ['Mathematics', 'Physics'],
                  assignedClasses: ['class-uuid-1'],
                },
                null,
                2
              ),
            },
            url: {
              raw: '{{baseUrl}}/teachers',
              host: ['{{baseUrl}}'],
              path: ['teachers'],
            },
            description: 'Create a new teacher',
          },
        },
      ],
    },
    // Admin Folder
    {
      name: 'Admin',
      item: [
        {
          name: 'Dashboard',
          item: [
            {
              name: 'Get Dashboard Stats',
              request: {
                method: 'GET',
                header: [
                  {
                    key: 'Authorization',
                    value: 'Bearer {{accessToken}}',
                  },
                  {
                    key: 'x-tenant-id',
                    value: '{{tenantId}}',
                  },
                ],
                url: {
                  raw: '{{baseUrl}}/admin/dashboard',
                  host: ['{{baseUrl}}'],
                  path: ['admin', 'dashboard'],
                },
                description: 'Get admin dashboard statistics',
              },
            },
          ],
        },
        {
          name: 'Departments',
          item: [
            {
              name: 'List Departments',
              request: {
                method: 'GET',
                header: [
                  {
                    key: 'Authorization',
                    value: 'Bearer {{accessToken}}',
                  },
                  {
                    key: 'x-tenant-id',
                    value: '{{tenantId}}',
                  },
                ],
                url: {
                  raw: '{{baseUrl}}/admin/departments',
                  host: ['{{baseUrl}}'],
                  path: ['admin', 'departments'],
                },
              },
            },
            {
              name: 'Create Department',
              request: {
                method: 'POST',
                header: [
                  {
                    key: 'Authorization',
                    value: 'Bearer {{accessToken}}',
                  },
                  {
                    key: 'x-tenant-id',
                    value: '{{tenantId}}',
                  },
                  {
                    key: 'Content-Type',
                    value: 'application/json',
                  },
                ],
                body: {
                  mode: 'raw',
                  raw: JSON.stringify(
                    {
                      name: 'Science Department',
                      description: 'Science and Technology',
                    },
                    null,
                    2
                  ),
                },
                url: {
                  raw: '{{baseUrl}}/admin/departments',
                  host: ['{{baseUrl}}'],
                  path: ['admin', 'departments'],
                },
              },
            },
          ],
        },
        {
          name: 'Classes',
          item: [
            {
              name: 'List Classes',
              request: {
                method: 'GET',
                header: [
                  {
                    key: 'Authorization',
                    value: 'Bearer {{accessToken}}',
                  },
                  {
                    key: 'x-tenant-id',
                    value: '{{tenantId}}',
                  },
                ],
                url: {
                  raw: '{{baseUrl}}/admin/classes',
                  host: ['{{baseUrl}}'],
                  path: ['admin', 'classes'],
                },
              },
            },
            {
              name: 'Create Class',
              request: {
                method: 'POST',
                header: [
                  {
                    key: 'Authorization',
                    value: 'Bearer {{accessToken}}',
                  },
                  {
                    key: 'x-tenant-id',
                    value: '{{tenantId}}',
                  },
                  {
                    key: 'Content-Type',
                    value: 'application/json',
                  },
                ],
                body: {
                  mode: 'raw',
                  raw: JSON.stringify(
                    {
                      name: 'Grade 10A',
                      description: 'Grade 10 Section A',
                    },
                    null,
                    2
                  ),
                },
                url: {
                  raw: '{{baseUrl}}/admin/classes',
                  host: ['{{baseUrl}}'],
                  path: ['admin', 'classes'],
                },
              },
            },
          ],
        },
      ],
    },
    // Superuser Folder
    {
      name: 'Superuser',
      item: [
        {
          name: 'Platform Overview',
          request: {
            method: 'GET',
            header: [
              {
                key: 'Authorization',
                value: 'Bearer {{accessToken}}',
              },
            ],
            url: {
              raw: '{{baseUrl}}/superuser/overview',
              host: ['{{baseUrl}}'],
              path: ['superuser', 'overview'],
            },
            description: 'Get platform-wide overview statistics (superuser only)',
          },
        },
        {
          name: 'List Schools',
          request: {
            method: 'GET',
            header: [
              {
                key: 'Authorization',
                value: 'Bearer {{accessToken}}',
              },
            ],
            url: {
              raw: '{{baseUrl}}/superuser/schools',
              host: ['{{baseUrl}}'],
              path: ['superuser', 'schools'],
            },
            description: 'List all schools/tenants (superuser only)',
          },
        },
        {
          name: 'Create School',
          request: {
            method: 'POST',
            header: [
              {
                key: 'Authorization',
                value: 'Bearer {{accessToken}}',
              },
              {
                key: 'Content-Type',
                value: 'application/json',
              },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify(
                {
                  name: 'New School',
                  slug: 'new-school',
                  domain: 'newschool.example.com',
                },
                null,
                2
              ),
            },
            url: {
              raw: '{{baseUrl}}/superuser/schools',
              host: ['{{baseUrl}}'],
              path: ['superuser', 'schools'],
            },
            description: 'Create a new school/tenant (superuser only)',
          },
        },
      ],
    },
  ],
};

// Write Postman Collection
const postmanPath = path.join(__dirname, '..', 'docs', 'api', 'postman-collection.json');
fs.writeFileSync(postmanPath, JSON.stringify(postmanCollection, null, 2));
console.log(`✅ Postman collection created: ${postmanPath}`);

// Copy OpenAPI spec to docs/api if it doesn't exist
const openApiSource = path.join(__dirname, '..', 'backend', 'openapi.yaml');
const openApiDest = path.join(__dirname, '..', 'docs', 'api', 'openapi.yaml');

if (fs.existsSync(openApiSource)) {
  fs.copyFileSync(openApiSource, openApiDest);
  console.log(`✅ OpenAPI spec copied: ${openApiDest}`);
} else {
  console.log(`⚠️  OpenAPI spec not found at: ${openApiSource}`);
}

console.log('\n✅ API documentation generation complete!');
console.log('\nFiles created:');
console.log(`  - ${postmanPath}`);
console.log(`  - ${openApiDest}`);
console.log('\nNext steps:');
console.log('  1. Import postman-collection.json into Postman');
console.log('  2. Set your baseUrl and tenantId variables');
console.log('  3. Run the Login request to get your access token');

