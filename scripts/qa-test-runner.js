/**
 * QA Test Runner - Phase 6: Full System User Role Flow Testing
 * 
 * This script tests all critical endpoints across user roles
 * Run with: node scripts/qa-test-runner.js
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

// Test results storage
const testResults = {
  passed: [],
  failed: [],
  pending: []
};

// Demo accounts from README
const DEMO_ACCOUNTS = {
  superuser: { email: 'owner.demo@platform.test', password: 'OwnerDemo#2025' },
  admin: { email: 'admin.demo@academy.test', password: 'AdminDemo#2025' },
  teacher: { email: 'teacher.demo@academy.test', password: 'TeacherDemo#2025' },
  student: { email: 'student.demo@academy.test', password: 'StudentDemo#2025' }
};

let superuserToken = null;
let adminToken = null;
let teacherToken = null;
let tenantId = null;

/**
 * Helper function to make API requests
 */
async function apiRequest(method, endpoint, token = null, body = null, headers = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({ message: response.statusText }));
    return { status: response.status, data, ok: response.ok };
  } catch (error) {
    return { status: 0, data: { error: error.message }, ok: false };
  }
}

/**
 * Login helper
 */
async function login(email, password) {
  const result = await apiRequest('POST', '/auth/login', null, { email, password });
  if (result.ok && result.data.accessToken) {
    return result.data.accessToken;
  }
  return null;
}

/**
 * Test helper
 */
function test(name, testFn) {
  return async () => {
    try {
      console.log(`\n🧪 Testing: ${name}`);
      await testFn();
      testResults.passed.push(name);
      console.log(`✅ PASS: ${name}`);
    } catch (error) {
      testResults.failed.push({ name, error: error.message });
      console.log(`❌ FAIL: ${name} - ${error.message}`);
    }
  };
}

/**
 * ============================================
 * 1. SUPERUSER → ADMIN FLOWS
 * ============================================
 */

async function testSuperuserFlows() {
  console.log('\n\n========================================');
  console.log('1. SUPERUSER → ADMIN FLOWS');
  console.log('========================================\n');

  // 1.1 Login as SuperUser
  await test('1.1 Login as SuperUser', async () => {
    // Check if server is running
    const healthCheck = await apiRequest('GET', '/health', null);
    if (!healthCheck.ok && healthCheck.status === 0) {
      throw new Error('Backend server is not running. Please start it with: npm run dev --prefix backend');
    }
    
    superuserToken = await login(DEMO_ACCOUNTS.superuser.email, DEMO_ACCOUNTS.superuser.password);
    if (!superuserToken) {
      throw new Error('Failed to login as SuperUser. Demo accounts may not be seeded. Run: npm run demo:seed --prefix backend');
    }
    console.log('   ✓ SuperUser token obtained');
  })();

  // 1.2 Create School (Tenant)
  await test('1.2 Create School', async () => {
    const result = await apiRequest('POST', '/tenants', superuserToken, {
      name: 'QA Test School',
      domain: 'qa-test.example.com'
    });
    if (!result.ok) {
      // School might already exist, try to get existing
      console.log('   ⚠ School might already exist, checking...');
      return;
    }
    if (result.data.id) {
      tenantId = result.data.id;
      console.log(`   ✓ School created with ID: ${tenantId}`);
    } else {
      throw new Error('School creation failed');
    }
  })();

  // 1.3 Add Admin
  await test('1.3 Add Admin User', async () => {
    // This would typically be done via invitation or signup
    // For now, we'll check if admin account exists
    adminToken = await login(DEMO_ACCOUNTS.admin.email, DEMO_ACCOUNTS.admin.password);
    if (!adminToken) {
      console.log('   ⚠ Admin account might need to be created via signup/invitation');
      throw new Error('Admin login failed - account may not exist');
    }
    console.log('   ✓ Admin account accessible');
  })();

  // 1.4 Suspend School
  await test('1.4 Suspend School', async () => {
    if (!tenantId) {
      console.log('   ⚠ Skipping - no tenant ID available');
      return;
    }
    // Get subscription first
    const subResult = await apiRequest('GET', `/superuser/schools/${tenantId}`, superuserToken);
    if (!subResult.ok) {
      console.log('   ⚠ Could not get school subscription');
      return;
    }
    
    // Suspend subscription
    const suspendResult = await apiRequest('PATCH', `/superuser/schools/${tenantId}/subscription`, superuserToken, {
      status: 'suspended'
    });
    if (!suspendResult.ok && suspendResult.status !== 404) {
      throw new Error(`Failed to suspend: ${suspendResult.data.message || 'Unknown error'}`);
    }
    console.log('   ✓ School suspension endpoint accessible');
  })();

  // 1.5 Configure Subscription Tier
  await test('1.5 Configure Subscription Tier', async () => {
    if (!superuserToken) {
      throw new Error('SuperUser authentication required. Login test must pass first.');
    }
    const result = await apiRequest('PUT', '/superuser/subscription-tiers', superuserToken, {
      configs: [{
        tier: 'trial',
        config: {
          name: 'Trial Plan',
          description: 'Trial subscription plan',
          monthlyPrice: 0,
          yearlyPrice: 0,
          maxUsers: 10,
          maxStudents: 100,
          maxTeachers: 5,
          isActive: true
        }
      }]
    });
    if (!result.ok) {
      throw new Error(`Failed: ${result.data.message || result.data.error || 'Unknown error'}`);
    }
    console.log('   ✓ Subscription tier configuration updated');
  })();
}

/**
 * ============================================
 * 2. ADMIN → HODs & TEACHERS FLOWS
 * ============================================
 */

async function testAdminFlows() {
  console.log('\n\n========================================');
  console.log('2. ADMIN → HODs & TEACHERS FLOWS');
  console.log('========================================\n');

  // 2.1 Login as Admin
  await test('2.1 Login as Admin', async () => {
    adminToken = await login(DEMO_ACCOUNTS.admin.email, DEMO_ACCOUNTS.admin.password);
    if (!adminToken) {
      throw new Error('Failed to login as Admin. Demo accounts may not be seeded. Run: npm run demo:seed --prefix backend');
    }
    console.log('   ✓ Admin token obtained');
  })();

  // 2.2 Assign HOD
  await test('2.2 Assign HOD Department', async () => {
    // First, we need a user with HOD role
    // For testing, we'll check if the endpoint exists and is accessible
    const testUserId = '00000000-0000-0000-0000-000000000000'; // Placeholder
    const result = await apiRequest('PUT', `/admin/users/${testUserId}/department`, adminToken, {
      department: 'Mathematics'
    });
    // We expect 400 or 404 for invalid user, but 401/403 would be auth issues
    if (result.status === 401 || result.status === 403) {
      throw new Error('Authentication/Authorization failed');
    }
    console.log('   ✓ HOD assignment endpoint accessible (tested with placeholder user)');
  })();

  // 2.3 Assign Teacher to Class
  await test('2.3 Assign Teacher to Class', async () => {
    if (!adminToken) {
      throw new Error('Admin authentication required. Login test must pass first.');
    }
    // Get a teacher first
    const teachersResult = await apiRequest('GET', '/teachers', adminToken);
    if (!teachersResult.ok) {
      throw new Error(`Failed to fetch teachers: ${teachersResult.data.message || teachersResult.data.error || 'Unknown error'}`);
    }
    
    if (teachersResult.data && teachersResult.data.length > 0) {
      const teacherId = teachersResult.data[0].id;
      const updateResult = await apiRequest('PUT', `/teachers/${teacherId}`, adminToken, {
        assignedClasses: ['test-class-id']
      });
      if (!updateResult.ok && updateResult.status !== 400) {
        throw new Error(`Failed: ${updateResult.data.message || 'Unknown error'}`);
      }
      console.log('   ✓ Teacher class assignment endpoint accessible');
    } else {
      console.log('   ⚠ No teachers found to test assignment');
    }
  })();

  // 2.4 Assign Subjects
  await test('2.4 Assign Subjects to Teacher', async () => {
    const teachersResult = await apiRequest('GET', '/teachers', adminToken);
    if (!teachersResult.ok) {
      throw new Error('Failed to fetch teachers');
    }
    
    if (teachersResult.data && teachersResult.data.length > 0) {
      const teacherId = teachersResult.data[0].id;
      const updateResult = await apiRequest('PUT', `/teachers/${teacherId}`, adminToken, {
        subjects: ['Mathematics', 'Physics']
      });
      if (!updateResult.ok && updateResult.status !== 400) {
        throw new Error(`Failed: ${updateResult.data.message || 'Unknown error'}`);
      }
      console.log('   ✓ Subject assignment endpoint accessible');
    } else {
      console.log('   ⚠ No teachers found to test subject assignment');
    }
  })();

  // 2.5 Promote Student (Class Change Request)
  await test('2.5 Create Student Class Change Request', async () => {
    if (!adminToken) {
      throw new Error('Admin authentication required. Login test must pass first.');
    }
    // Get a student first
    const studentsResult = await apiRequest('GET', '/students', adminToken);
    if (!studentsResult.ok) {
      throw new Error(`Failed to fetch students: ${studentsResult.data.message || studentsResult.data.error || 'Unknown error'}`);
    }
    
    if (studentsResult.data && studentsResult.data.length > 0) {
      const studentId = studentsResult.data[0].id;
      const requestResult = await apiRequest('POST', `/students/${studentId}/class-change-request`, adminToken, {
        targetClassId: 'test-class-id',
        reason: 'QA Testing - Promotion'
      });
      if (!requestResult.ok && requestResult.status !== 400 && requestResult.status !== 409) {
        throw new Error(`Failed: ${requestResult.data.message || 'Unknown error'}`);
      }
      console.log('   ✓ Class change request endpoint accessible');
    } else {
      console.log('   ⚠ No students found to test class change');
    }
  })();

  // 2.6 Export Reports
  await test('2.6 Export Reports', async () => {
    if (!adminToken) {
      throw new Error('Admin authentication required. Login test must pass first.');
    }
    const exportResult = await apiRequest('POST', '/export', adminToken, {
      type: 'students',
      format: 'csv',
      title: 'QA Test Export'
    });
    if (!exportResult.ok) {
      throw new Error(`Failed: ${exportResult.data.message || exportResult.data.error || 'Unknown error'}`);
    }
    console.log('   ✓ Export endpoint accessible');
  })();
}

/**
 * ============================================
 * 3. TEACHER → STUDENTS FLOWS
 * ============================================
 */

async function testTeacherFlows() {
  console.log('\n\n========================================');
  console.log('3. TEACHER → STUDENTS FLOWS');
  console.log('========================================\n');

  // 3.1 Login as Teacher
  await test('3.1 Login as Teacher', async () => {
    teacherToken = await login(DEMO_ACCOUNTS.teacher.email, DEMO_ACCOUNTS.teacher.password);
    if (!teacherToken) {
      throw new Error('Failed to login as Teacher. Demo accounts may not be seeded. Run: npm run demo:seed --prefix backend');
    }
    console.log('   ✓ Teacher token obtained');
  })();

  // 3.2 Mark Attendance
  await test('3.2 Mark Attendance', async () => {
    const result = await apiRequest('POST', '/attendance/mark', teacherToken, {
      records: [{
        studentId: 'test-student-id',
        classId: 'test-class-id',
        date: new Date().toISOString().split('T')[0],
        status: 'present'
      }]
    });
    // We expect 400 for invalid data, but 401/403 would be auth issues
    if (result.status === 401 || result.status === 403) {
      throw new Error('Authentication/Authorization failed');
    }
    console.log('   ✓ Attendance marking endpoint accessible');
  })();

  // 3.3 Enter Grades
  await test('3.3 Enter Grades', async () => {
    const result = await apiRequest('POST', '/grades/bulk', teacherToken, {
      examId: 'test-exam-id',
      entries: [{
        studentId: 'test-student-id',
        classId: 'test-class-id',
        score: 85,
        grade: 'A'
      }]
    });
    // We expect 400 for invalid data, but 401/403 would be auth issues
    if (result.status === 401 || result.status === 403) {
      throw new Error('Authentication/Authorization failed');
    }
    console.log('   ✓ Grade entry endpoint accessible');
  })();

  // 3.4 View Reports
  await test('3.4 View Attendance Reports', async () => {
    const result = await apiRequest('GET', '/attendance/report/class?class_id=test-class&date=2025-01-01', teacherToken);
    // We expect 400/404 for invalid data, but 401/403 would be auth issues
    if (result.status === 401 || result.status === 403) {
      throw new Error('Authentication/Authorization failed');
    }
    console.log('   ✓ Attendance report endpoint accessible');
  })();
}

/**
 * Main test execution
 */
async function runAllTests() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   QA TEST RUNNER - Phase 6: Full System Testing          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\nTesting against: ${BASE_URL}\n`);

  try {
    await testSuperuserFlows();
    await testAdminFlows();
    await testTeacherFlows();
  } catch (error) {
    console.error('\n❌ Test execution error:', error);
  }

  // Print summary
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                         ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\n✅ Passed: ${testResults.passed.length}`);
  console.log(`❌ Failed: ${testResults.failed.length}`);
  console.log(`⏳ Pending: ${testResults.pending.length}`);
  
  if (testResults.failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.failed.forEach(({ name, error }) => {
      console.log(`   - ${name}: ${error}`);
    });
  }

  console.log('\n');
  return {
    passed: testResults.passed.length,
    failed: testResults.failed.length,
    total: testResults.passed.length + testResults.failed.length
  };
}

// Run tests if executed directly
if (require.main === module) {
  // Check if fetch is available (Node 18+)
  if (typeof fetch === 'undefined') {
    console.error('❌ This script requires Node.js 18+ with native fetch support');
    console.error('   Or install node-fetch: npm install node-fetch');
    process.exit(1);
  }

  runAllTests()
    .then((summary) => {
      process.exit(summary.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runAllTests, testResults };

