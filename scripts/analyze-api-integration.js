/**
 * API Integration Analysis Script
 * Maps UI components to API endpoints and detects schema drift
 */

const fs = require('fs');
const path = require('path');

// Admin pages to analyze
const adminPages = [
  {
    name: 'Users Management',
    component: 'frontend/src/pages/admin/users/page.tsx',
    hook: 'useAdminUsers',
    endpoint: '/admin/users',
    method: 'GET',
  },
  {
    name: 'Students Management',
    component: 'frontend/src/pages/admin/StudentsManagementPage.tsx',
    hook: 'useStudents',
    endpoint: '/students',
    method: 'GET',
  },
  {
    name: 'Teachers Management',
    component: 'frontend/src/pages/admin/TeachersManagementPage.tsx',
    hook: 'useTeachers',
    endpoint: '/teachers',
    method: 'GET',
  },
  {
    name: 'Classes Management',
    component: 'frontend/src/pages/admin/classes/page.tsx',
    hook: 'useAdminClasses',
    endpoint: '/admin/classes',
    method: 'GET',
  },
  {
    name: 'Departments',
    component: 'frontend/src/pages/admin/departments/page.tsx',
    hook: 'useDepartments',
    endpoint: '/admin/departments',
    method: 'GET',
  },
];

// Expected UI fields (from component analysis)
const uiExpectations = {
  'Users Management': {
    fields: ['id', 'email', 'role', 'status', 'isVerified', 'createdAt'],
    displayFields: ['email', 'role', 'status', 'isVerified'],
  },
  'Students Management': {
    fields: [
      'id',
      'first_name',
      'last_name',
      'email',
      'admission_number',
      'class_id',
      'enrollment_status',
      'parentContacts',
    ],
    displayFields: ['first_name', 'last_name', 'admission_number', 'class_id', 'enrollment_status'],
  },
  'Teachers Management': {
    fields: ['id', 'name', 'email', 'subjects', 'assigned_classes'],
    displayFields: ['name', 'email', 'subjects', 'assigned_classes'],
  },
  'Classes Management': {
    fields: [
      'id',
      'name',
      'description',
      'gradeLevel',
      'section',
      'departmentId',
      'classTeacherId',
      'capacity',
      'academicYear',
      'studentCount',
      'teacherName',
    ],
    displayFields: ['name', 'gradeLevel', 'section', 'studentCount', 'teacherName'],
  },
  'Departments': {
    fields: ['id', 'name', 'slug', 'contactEmail', 'contactPhone', 'hodCount', 'teacherCount'],
    displayFields: ['name', 'slug', 'hodCount', 'teacherCount'],
  },
};

// API endpoint mappings from api.ts
const apiMappings = {
  '/admin/users': {
    method: 'GET',
    handler: 'api.admin.listUsers',
    expectedResponse: 'AdminUser[]',
  },
  '/students': {
    method: 'GET',
    handler: 'api.listStudents',
    expectedResponse: 'StudentRecord[]',
  },
  '/teachers': {
    method: 'GET',
    handler: 'api.listTeachers',
    expectedResponse: 'TeacherProfile[]',
  },
  '/admin/classes': {
    method: 'GET',
    handler: 'api.admin.listClasses',
    expectedResponse: 'AdminClass[]',
  },
  '/admin/departments': {
    method: 'GET',
    handler: 'api.admin.listDepartments',
    expectedResponse: 'Department[]',
  },
};

// Type definitions from hooks (simplified)
const typeDefinitions = {
  AdminUser: {
    id: 'string',
    email: 'string',
    role: 'string',
    status: 'string',
    isVerified: 'boolean',
    createdAt: 'string',
  },
  StudentRecord: {
    id: 'string',
    first_name: 'string',
    last_name: 'string',
    email: 'string',
    admission_number: 'string',
    class_id: 'string | null',
    enrollment_status: 'string',
    parentContacts: 'Array<{name: string, relationship: string, phone: string}>',
  },
  TeacherProfile: {
    id: 'string',
    name: 'string',
    email: 'string',
    subjects: 'string[]',
    assigned_classes: 'string[]',
  },
  AdminClass: {
    id: 'string',
    name: 'string',
    description: 'string | null',
    gradeLevel: 'string | null',
    section: 'string | null',
    departmentId: 'string | null',
    classTeacherId: 'string | null',
    capacity: 'number | null',
    academicYear: 'string | null',
    studentCount: 'number',
    teacherName: 'string',
    createdAt: 'string',
    updatedAt: 'string',
  },
  Department: {
    id: 'string',
    name: 'string',
    slug: 'string',
    contactEmail: 'string | null',
    contactPhone: 'string | null',
    hodCount: 'number',
    teacherCount: 'number',
    createdAt: 'string',
    updatedAt: 'string',
  },
};

function analyzePage(page) {
  const expectations = uiExpectations[page.name];
  const apiMapping = apiMappings[page.endpoint];
  const typeDef = typeDefinitions[apiMapping.expectedResponse.replace('[]', '')];

  if (!expectations || !apiMapping || !typeDef) {
    return {
      page: page.name,
      status: 'FAIL',
      error: 'Missing configuration',
    };
  }

  // Check for schema drift
  const expectedFields = expectations.fields;
  const actualFields = Object.keys(typeDef);
  const missingFields = expectedFields.filter((field) => !actualFields.includes(field));
  const extraFields = actualFields.filter((field) => !expectedFields.includes(field));

  const hasDrift = missingFields.length > 0 || extraFields.length > 0;

  return {
    page: page.name,
    component: page.component,
    hook: page.hook,
    endpoint: page.endpoint,
    method: page.method,
    apiHandler: apiMapping.handler,
    expectedResponseType: apiMapping.expectedResponse,
    uiExpectedFields: expectedFields,
    backendFields: actualFields,
    missingFields: missingFields,
    extraFields: extraFields,
    status: hasDrift ? 'DRIFT' : 'OK',
    notes: hasDrift
      ? `Schema drift detected: Missing fields: ${missingFields.join(', ') || 'none'}, Extra fields: ${extraFields.join(', ') || 'none'}`
      : 'No schema drift detected',
  };
}

// Generate report
const report = {
  timestamp: new Date().toISOString(),
  summary: {
    totalPages: adminPages.length,
    ok: 0,
    drift: 0,
    fail: 0,
  },
  pages: adminPages.map(analyzePage),
};

// Calculate summary
report.pages.forEach((page) => {
  if (page.status === 'OK') report.summary.ok++;
  else if (page.status === 'DRIFT') report.summary.drift++;
  else report.summary.fail++;
});

// Write report
const reportPath = path.join(__dirname, '..', 'integration_report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log('API Integration Analysis Complete');
console.log(`Report written to: ${reportPath}`);
console.log(`\nSummary:`);
console.log(`  Total Pages: ${report.summary.totalPages}`);
console.log(`  OK: ${report.summary.ok}`);
console.log(`  DRIFT: ${report.summary.drift}`);
console.log(`  FAIL: ${report.summary.fail}`);

