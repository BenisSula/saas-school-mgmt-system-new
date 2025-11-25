# Load Testing Setup

This directory contains load testing scripts for the SaaS School Management System.

## Prerequisites

1. **K6** - Install from https://k6.io
   ```bash
   # macOS
   brew install k6
   
   # Linux
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D9
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6
   
   # Windows
   # Download from https://github.com/grafana/k6/releases
   ```

2. **Backend Running** - Ensure the backend is running and accessible

## Running Load Tests

### Basic Test
```bash
k6 run load-testing/k6-load-test.js
```

### With Custom Configuration
```bash
API_URL=http://localhost:3001 \
TEST_EMAIL=admin@example.com \
TEST_PASSWORD=password123 \
k6 run load-testing/k6-load-test.js
```

### Production Load Test
```bash
API_URL=https://api.yourdomain.com \
TEST_EMAIL=admin@yourdomain.com \
TEST_PASSWORD=yourpassword \
k6 run load-testing/k6-load-test.js
```

## Test Scenarios

The default test includes:
1. **Health Check** - Basic endpoint availability
2. **Dashboard** - Admin dashboard data loading
3. **Students List** - Student data retrieval

## Performance Targets

- **Response Time**: 95% of requests should complete in < 500ms
- **Error Rate**: < 1% of requests should fail
- **Concurrent Users**: Tested up to 100 concurrent users

## Customizing Tests

Edit `k6-load-test.js` to:
- Add more endpoints
- Adjust load patterns (stages)
- Modify performance thresholds
- Add custom metrics

## Monitoring

K6 provides real-time metrics:
- Request rate
- Response times (p50, p95, p99)
- Error rates
- Data transfer

## Integration with CI/CD

Add to your CI/CD pipeline:
```yaml
- name: Run Load Tests
  run: |
    k6 run load-testing/k6-load-test.js
```

