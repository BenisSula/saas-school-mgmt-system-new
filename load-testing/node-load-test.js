/**
 * Node.js Load Testing Script (Alternative to K6)
 * Tests backend API endpoints under load
 * 
 * Run: node load-testing/node-load-test.js
 * 
 * This script provides basic load testing without requiring K6 installation
 */

const http = require('http');
const https = require('https');

// Configuration
const CONFIG = {
  baseUrl: process.env.API_URL || 'http://localhost:3001',
  testEmail: process.env.TEST_EMAIL || 'admin@example.com',
  testPassword: process.env.TEST_PASSWORD || 'password123',
  concurrentUsers: parseInt(process.env.CONCURRENT_USERS || '10'),
  duration: parseInt(process.env.DURATION_SECONDS || '60'),
  rampUpTime: parseInt(process.env.RAMP_UP_SECONDS || '10'),
};

// Statistics
const stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  responseTimes: [],
  errors: [],
};

// Helper to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const startTime = Date.now();
    const req = protocol.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        stats.responseTimes.push(responseTime);
        stats.totalRequests++;
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          stats.successfulRequests++;
        } else {
          stats.failedRequests++;
          stats.errors.push({
            url,
            statusCode: res.statusCode,
            message: data.substring(0, 100),
          });
        }
        
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          responseTime,
        });
      });
    });

    req.on('error', (error) => {
      stats.failedRequests++;
      stats.totalRequests++;
      stats.errors.push({ url, error: error.message });
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// Login and get token
async function login() {
  try {
    const response = await makeRequest(`${CONFIG.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: CONFIG.testEmail,
        password: CONFIG.testPassword,
      }),
    });

    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      return body.token || body.data?.token || null;
    }
    return null;
  } catch (error) {
    console.error('Login failed:', error.message);
    return null;
  }
}

// Test a single user session
async function testUser(token) {
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Test health endpoint
  try {
    await makeRequest(`${CONFIG.baseUrl}/api/health`, { headers });
  } catch (error) {
    // Ignore errors for statistics
  }

  // Test dashboard (if authenticated)
  if (token) {
    try {
      await makeRequest(`${CONFIG.baseUrl}/api/admin/dashboard`, { headers });
    } catch (error) {
      // Ignore errors for statistics
    }

    // Test students list
    try {
      await makeRequest(`${CONFIG.baseUrl}/api/students?limit=10`, { headers });
    } catch (error) {
      // Ignore errors for statistics
    }
  }
}

// Calculate statistics
function calculateStats() {
  const responseTimes = stats.responseTimes.sort((a, b) => a - b);
  const count = responseTimes.length;
  
  const p50 = responseTimes[Math.floor(count * 0.5)] || 0;
  const p95 = responseTimes[Math.floor(count * 0.95)] || 0;
  const p99 = responseTimes[Math.floor(count * 0.99)] || 0;
  const avg = count > 0 ? responseTimes.reduce((a, b) => a + b, 0) / count : 0;
  const min = responseTimes[0] || 0;
  const max = responseTimes[count - 1] || 0;

  const successRate = stats.totalRequests > 0 
    ? (stats.successfulRequests / stats.totalRequests) * 100 
    : 0;
  const errorRate = stats.totalRequests > 0 
    ? (stats.failedRequests / stats.totalRequests) * 100 
    : 0;

  return {
    totalRequests: stats.totalRequests,
    successfulRequests: stats.successfulRequests,
    failedRequests: stats.failedRequests,
    successRate: successRate.toFixed(2) + '%',
    errorRate: errorRate.toFixed(2) + '%',
    responseTime: {
      min: min + 'ms',
      max: max + 'ms',
      avg: avg.toFixed(2) + 'ms',
      p50: p50 + 'ms',
      p95: p95 + 'ms',
      p99: p99 + 'ms',
    },
    errors: stats.errors.slice(0, 10), // Show first 10 errors
  };
}

// Main load test function
async function runLoadTest() {
  console.log('🚀 Starting Load Test...');
  console.log(`Base URL: ${CONFIG.baseUrl}`);
  console.log(`Concurrent Users: ${CONFIG.concurrentUsers}`);
  console.log(`Duration: ${CONFIG.duration}s`);
  console.log(`Ramp Up Time: ${CONFIG.rampUpTime}s\n`);

  // Login to get token
  console.log('🔐 Authenticating...');
  const token = await login();
  if (token) {
    console.log('✅ Authentication successful\n');
  } else {
    console.log('⚠️  Authentication failed, continuing with unauthenticated tests\n');
  }

  // Ramp up users
  const rampUpInterval = CONFIG.rampUpTime / CONFIG.concurrentUsers;
  const users = [];
  
  console.log('📈 Ramping up users...');
  for (let i = 0; i < CONFIG.concurrentUsers; i++) {
    setTimeout(() => {
      const userLoop = async () => {
        const startTime = Date.now();
        while (Date.now() - startTime < CONFIG.duration * 1000) {
          await testUser(token);
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second between requests
        }
      };
      users.push(userLoop());
    }, i * rampUpInterval * 1000);
  }

  // Wait for all users to complete
  await Promise.all(users);

  // Calculate and display results
  console.log('\n📊 Load Test Results:');
  console.log('='.repeat(50));
  const results = calculateStats();
  console.log(JSON.stringify(results, null, 2));
  console.log('='.repeat(50));

  // Performance assessment
  if (parseFloat(results.responseTime.p95) < 500) {
    console.log('\n✅ Performance: PASSED (p95 < 500ms)');
  } else {
    console.log('\n⚠️  Performance: WARNING (p95 >= 500ms)');
  }

  if (parseFloat(results.errorRate) < 1) {
    console.log('✅ Error Rate: PASSED (< 1%)');
  } else {
    console.log('❌ Error Rate: FAILED (>= 1%)');
  }

  if (results.errors.length > 0) {
    console.log('\n⚠️  Sample Errors:');
    results.errors.forEach((error, i) => {
      console.log(`  ${i + 1}. ${error.url} - ${error.statusCode || error.error}`);
    });
  }
}

// Run the test
runLoadTest().catch(console.error);

