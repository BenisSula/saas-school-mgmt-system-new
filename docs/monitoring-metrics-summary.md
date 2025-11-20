# Monitoring & Metrics Implementation Summary

## Overview

Comprehensive platform metrics collection and monitoring using Prometheus. All metrics are exposed via `/metrics` endpoint and can be scraped by Prometheus.

## Implemented Metrics

### ✅ 1. Active Sessions Count

**Metric:** `sessions_active` (Gauge)
- **Description:** Number of active user sessions
- **Labels:** None
- **Update Frequency:** Every 30 seconds
- **Source:** `shared.user_sessions` table (is_active = TRUE AND expires_at > NOW())

**Implementation:**
- Collected by `platformMetricsService.ts`
- Updated via `metrics.setActiveSessions(count)`

### ✅ 2. Login Attempts (Success/Fail)

**Metrics:**
- `auth_attempts_total` (Counter) - Total authentication attempts
  - Labels: `method`, `success`
- `auth_attempts_success_total` (Counter) - Successful login attempts
  - Labels: `method`
- `auth_attempts_failed_total` (Counter) - Failed login attempts
  - Labels: `method`, `ip_address`

**Implementation:**
- Tracked in real-time via `metrics.incrementAuthAttempt()` in auth routes
- Incremented on each login attempt (success or failure)
- IP address tracked for failed attempts

### ✅ 3. Failed Login IP Heatmap

**Metric:** `failed_login_attempts_by_ip` (Gauge)
- **Description:** Number of failed login attempts by IP address
- **Labels:** `ip_address`
- **Update Frequency:** Every 30 seconds
- **Source:** `shared.login_attempts` table (success = FALSE, last 24 hours, top 100 IPs)

**Implementation:**
- Collected by `platformMetricsService.ts`
- Tracks top 100 IPs with most failed attempts
- Automatically removes IPs that drop out of top 100
- Can be visualized as heatmap in Grafana

### ✅ 4. Tenant Count

**Metrics:**
- `active_tenants_total` (Gauge) - Number of active tenants
- `tenants_total` (Gauge) - Total number of tenants (alias)

**Implementation:**
- Collected by `platformMetricsService.ts`
- Updated every 30 seconds
- Source: `shared.tenants` table (status = 'active' OR status IS NULL)

### ✅ 5. API Latency

**Metric:** `http_request_duration_seconds` (Histogram)
- **Description:** Duration of HTTP requests in seconds
- **Labels:** `method`, `route`, `status_code`
- **Buckets:** [0.1, 0.5, 1, 2, 5, 10] seconds
- **Update Frequency:** Real-time (on each request)

**Implementation:**
- Tracked via `metricsMiddleware` in `middleware/metrics.ts`
- Measures time from request start to response end
- Provides p50, p95, p99 percentiles

## Additional Metrics

### HTTP Metrics
- `http_requests_total` (Counter) - Total HTTP requests
- `http_request_size_bytes` (Histogram) - Request size
- `http_response_size_bytes` (Histogram) - Response size

### System Metrics
- Default Prometheus metrics (CPU, memory, etc.) via `collectDefaultMetrics()`

### Business Metrics
- `active_users_total` (Gauge) - Active users per tenant
- `api_calls_total` (Counter) - API calls per endpoint
- `database_query_duration_seconds` (Histogram) - Database query duration
- `database_connections_active` (Gauge) - Active database connections
- `errors_total` (Counter) - Error counts by type

## Metrics Collection Service

**File:** `backend/src/services/monitoring/platformMetricsService.ts`

**Functions:**
- `collectPlatformMetrics()` - Collects all platform metrics
- `startMetricsCollection()` - Starts periodic collection (every 30 seconds)
- `stopMetricsCollection()` - Stops periodic collection

**Collection Frequency:** 30 seconds

**Metrics Updated:**
1. Active sessions count
2. Tenant count
3. Login attempts (from database)
4. Failed login IP heatmap

## Integration Points

### Server Startup
- Metrics collection starts automatically on server startup
- Integrated in `backend/src/server.ts`

### Auth Routes
- Login attempts tracked in real-time
- Success/failure metrics incremented immediately
- IP address captured for failed attempts

### Middleware
- HTTP latency tracked via `metricsMiddleware`
- Applied to all routes in `app.ts`

## Prometheus Endpoint

**Endpoint:** `GET /metrics`
- **Content-Type:** `text/plain; version=0.0.4; charset=utf-8`
- **Authentication:** None (should be protected in production)
- **Format:** Prometheus text format

**Example Query:**
```promql
# Active sessions
sessions_active

# Failed login attempts by IP
failed_login_attempts_by_ip

# Login success rate
rate(auth_attempts_success_total[5m]) / rate(auth_attempts_total[5m])

# API latency p95
histogram_quantile(0.95, http_request_duration_seconds_bucket)

# Tenant count
tenants_total
```

## Grafana Dashboard Queries

### Active Sessions Over Time
```promql
sessions_active
```

### Failed Login Attempts by IP (Heatmap)
```promql
failed_login_attempts_by_ip
```

### Login Success Rate
```promql
sum(rate(auth_attempts_success_total[5m])) / sum(rate(auth_attempts_total[5m])) * 100
```

### API Latency Percentiles
```promql
# p50
histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

# p95
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

# p99
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
```

### Tenant Count
```promql
tenants_total
```

## Configuration

### Environment Variables
- `METRICS_COLLECTION_INTERVAL_MS` - Collection interval (default: 30000ms / 30 seconds)

### Prometheus Scrape Config
```yaml
scrape_configs:
  - job_name: 'saas-school-mgmt'
    scrape_interval: 15s
    metrics_path: '/metrics'
    static_configs:
      - targets: ['localhost:3001']
```

## Performance Considerations

- Metrics collection runs asynchronously
- Database queries are optimized with indexes
- Failed metrics collection doesn't block requests
- Metrics middleware has minimal overhead
- Collection interval configurable (default: 30 seconds)

## Monitoring Best Practices

1. **Alerting Rules:**
   - Alert on high failed login attempts from single IP
   - Alert on API latency p95 > 2 seconds
   - Alert on active sessions dropping unexpectedly
   - Alert on tenant count changes

2. **Dashboards:**
   - Platform overview dashboard
   - Security dashboard (login attempts, failed IPs)
   - Performance dashboard (API latency, throughput)
   - Capacity dashboard (sessions, tenants, users)

3. **Retention:**
   - Configure Prometheus retention policy
   - Use long-term storage for historical data
   - Archive critical metrics

## Related Files

- `backend/src/middleware/metrics.ts` - Metrics definitions and middleware
- `backend/src/routes/metrics.ts` - Prometheus metrics endpoint
- `backend/src/services/monitoring/platformMetricsService.ts` - Metrics collection service
- `backend/src/server.ts` - Server startup with metrics collection
- `backend/src/routes/auth.ts` - Login attempt tracking

## Testing

### Verify Metrics Endpoint
```bash
curl http://localhost:3001/metrics
```

### Check Specific Metrics
```bash
# Active sessions
curl http://localhost:3001/metrics | grep sessions_active

# Login attempts
curl http://localhost:3001/metrics | grep auth_attempts

# Failed login IPs
curl http://localhost:3001/metrics | grep failed_login_attempts_by_ip

# Tenant count
curl http://localhost:3001/metrics | grep tenants_total

# API latency
curl http://localhost:3001/metrics | grep http_request_duration_seconds
```

## Future Enhancements

1. **Additional Metrics:**
   - User registration rate
   - Password reset requests
   - Session duration distribution
   - Tenant-specific metrics

2. **Advanced Features:**
   - Custom metric exporters
   - Metric aggregation by tenant
   - Real-time alerting integration
   - Metric export to external systems

3. **Optimization:**
   - Batch metric updates
   - Cache frequently accessed metrics
   - Reduce collection frequency for expensive queries

