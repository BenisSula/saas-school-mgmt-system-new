/**
 * Load Test for Attendance Marking Endpoints
 * Tests attendance marking functionality under load
 * 
 * Usage: node scripts/load-tests/attendance-load-test.js
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const CONCURRENT_REQUESTS = parseInt(process.env.CONCURRENT_REQUESTS || '10', 10);
const TOTAL_REQUESTS = parseInt(process.env.TOTAL_REQUESTS || '50', 10);

// Demo account for testing
const DEMO_ACCOUNT = {
  email: 'teacher.demo@academy.test',
  password: 'TeacherDemo#2025'
};

let authToken = null;

/**
 * Login and get auth token
 */
async function login() {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(DEMO_ACCOUNT)
  });
  
  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }
  
  const data = await response.json();
  return data.accessToken;
}

/**
 * Make attendance marking request
 */
async function makeAttendanceRequest(token) {
  const startTime = Date.now();
  try {
    // Create test attendance records
    const today = new Date().toISOString().split('T')[0];
    const records = [
      {
        studentId: '00000000-0000-0000-0000-000000000001',
        classId: 'test-class-1',
        date: today,
        status: 'present'
      },
      {
        studentId: '00000000-0000-0000-0000-000000000002',
        classId: 'test-class-1',
        date: today,
        status: 'present'
      }
    ];

    const response = await fetch(`${BASE_URL}/attendance/mark`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ records })
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        status: response.status,
        duration,
        error: errorText
      };
    }
    
    return {
      success: true,
      status: response.status,
      duration
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - startTime,
      error: error.message
    };
  }
}

/**
 * Run load test
 */
async function runLoadTest() {
  console.log('\n🚀 Starting Attendance Marking Load Test');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Concurrent Requests: ${CONCURRENT_REQUESTS}`);
  console.log(`   Total Requests: ${TOTAL_REQUESTS}\n`);

  // Login
  console.log('🔐 Logging in...');
  try {
    authToken = await login();
    console.log('✅ Login successful\n');
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    process.exit(1);
  }

  const results = [];
  const batches = Math.ceil(TOTAL_REQUESTS / CONCURRENT_REQUESTS);

  for (let batch = 0; batch < batches; batch++) {
    const batchStart = batch * CONCURRENT_REQUESTS;
    const batchEnd = Math.min(batchStart + CONCURRENT_REQUESTS, TOTAL_REQUESTS);
    const batchSize = batchEnd - batchStart;

    console.log(`📦 Batch ${batch + 1}/${batches} (${batchSize} requests)...`);
    
    const batchPromises = [];
    for (let i = 0; i < batchSize; i++) {
      batchPromises.push(makeAttendanceRequest(authToken));
    }

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Print batch summary
    const batchSuccess = batchResults.filter(r => r.success).length;
    const batchAvgDuration = batchResults.reduce((sum, r) => sum + r.duration, 0) / batchResults.length;
    console.log(`   ✅ ${batchSuccess}/${batchSize} successful, avg duration: ${batchAvgDuration.toFixed(0)}ms\n`);
  }

  // Print final summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  const minDuration = Math.min(...results.map(r => r.duration));
  const maxDuration = Math.max(...results.map(r => r.duration));
  const p95Duration = results.sort((a, b) => a.duration - b.duration)[Math.floor(results.length * 0.95)].duration;

  console.log('📊 Load Test Summary');
  console.log('═══════════════════════════════════════');
  console.log(`Total Requests: ${TOTAL_REQUESTS}`);
  console.log(`Successful: ${successful} (${((successful / TOTAL_REQUESTS) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${failed} (${((failed / TOTAL_REQUESTS) * 100).toFixed(1)}%)`);
  console.log(`Average Duration: ${avgDuration.toFixed(0)}ms`);
  console.log(`Min Duration: ${minDuration}ms`);
  console.log(`Max Duration: ${maxDuration}ms`);
  console.log(`P95 Duration: ${p95Duration}ms`);
  console.log('═══════════════════════════════════════\n');

  if (failed > 0) {
    const errorCounts = {};
    results.filter(r => !r.success).forEach(r => {
      const key = r.error || `Status ${r.status}`;
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });
    console.log('❌ Error Breakdown:');
    Object.entries(errorCounts).forEach(([error, count]) => {
      console.log(`   ${error}: ${count}`);
    });
    console.log('');
  }

  return {
    total: TOTAL_REQUESTS,
    successful,
    failed,
    avgDuration,
    minDuration,
    maxDuration,
    p95Duration
  };
}

// Run if executed directly
if (require.main === module) {
  if (typeof fetch === 'undefined') {
    console.error('❌ This script requires Node.js 18+ with native fetch support');
    process.exit(1);
  }

  runLoadTest()
    .then((summary) => {
      process.exit(summary.failed > TOTAL_REQUESTS * 0.1 ? 1 : 0); // Fail if >10% errors
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runLoadTest };

