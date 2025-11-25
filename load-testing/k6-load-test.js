/**
 * K6 Load Testing Script
 * Tests backend API endpoints under load
 * 
 * Installation: brew install k6 (macOS) or download from https://k6.io
 * Run: k6 run load-testing/k6-load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiResponseTime = new Trend('api_response_time');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 10 },  // Stay at 10 users
    { duration: '30s', target: 50 },  // Ramp up to 50 users
    { duration: '2m', target: 50 },   // Stay at 50 users
    { duration: '30s', target: 100 }, // Ramp up to 100 users
    { duration: '2m', target: 100 },  // Stay at 100 users
    { duration: '30s', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'],   // Error rate should be less than 1%
    errors: ['rate<0.01'],            // Custom error rate
  },
};

// Base URL - adjust for your environment
const BASE_URL = __ENV.API_URL || 'http://localhost:3001';

// Test data
const testCredentials = {
  email: __ENV.TEST_EMAIL || 'admin@example.com',
  password: __ENV.TEST_PASSWORD || 'password123',
};

let authToken = '';

// Setup: Authenticate and get token
export function setup() {
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: testCredentials.email,
    password: testCredentials.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status === 200) {
    const body = JSON.parse(loginRes.body);
    return { token: body.token || body.data?.token };
  }

  return { token: null };
}

// Main test function
export default function (data) {
  const token = data.token || authToken;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };

  // Test health endpoint
  const healthRes = http.get(`${BASE_URL}/api/health`, { headers });
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
  });
  errorRate.add(healthRes.status !== 200);
  apiResponseTime.add(healthRes.timings.duration);

  sleep(1);

  // Test dashboard endpoint (if authenticated)
  if (token) {
    const dashboardRes = http.get(`${BASE_URL}/api/admin/dashboard`, { headers });
    check(dashboardRes, {
      'dashboard status is 200': (r) => r.status === 200,
      'dashboard has data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data !== undefined;
        } catch {
          return false;
        }
      },
    });
    errorRate.add(dashboardRes.status !== 200);
    apiResponseTime.add(dashboardRes.timings.duration);
  }

  sleep(1);

  // Test students list endpoint
  if (token) {
    const studentsRes = http.get(`${BASE_URL}/api/students?limit=10`, { headers });
    check(studentsRes, {
      'students list status is 200': (r) => r.status === 200,
    });
    errorRate.add(studentsRes.status !== 200);
    apiResponseTime.add(studentsRes.timings.duration);
  }

  sleep(1);
}

// Teardown
export function teardown(data) {
  console.log('Load test completed');
}

