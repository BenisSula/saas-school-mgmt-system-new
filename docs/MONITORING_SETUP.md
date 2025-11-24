# Monitoring Stack Setup Guide

This guide explains how to set up and run the monitoring stack (Prometheus + Grafana).

## Prerequisites

1. **Docker Desktop** must be installed and running
2. **Docker Compose** v2.0+ (included with Docker Desktop)

## Quick Start

### 1. Start Docker Desktop

Ensure Docker Desktop is running on your system:
- **Windows:** Start Docker Desktop from Start Menu
- **macOS:** Start Docker Desktop from Applications
- **Linux:** Ensure Docker daemon is running: `sudo systemctl start docker`

### 2. Verify Docker is Running

```bash
docker ps
```

If this command works, Docker is running.

### 3. Start Monitoring Stack

```bash
# Start Prometheus and Grafana
docker-compose -f docker-compose.production.yml up -d prometheus grafana

# Check status
docker-compose -f docker-compose.production.yml ps

# View logs
docker-compose -f docker-compose.production.yml logs -f prometheus grafana
```

### 4. Access Services

Once started, access the services:

- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:3000
  - Default username: `admin`
  - Default password: `admin` (change on first login)

## Configuration

### Prometheus

**Configuration File:** `monitoring/prometheus/prometheus.yml`

**Scrape Targets:**
- Backend API: `backend:3001/metrics`
- Scrape interval: 10 seconds

**Alert Rules:** `monitoring/prometheus/alerts.yml`

### Grafana

**Dashboards:** `monitoring/grafana/dashboards/`
- Backend Metrics Dashboard (auto-provisioned)

**Data Sources:** `monitoring/grafana/datasources/`
- Prometheus (auto-configured)

## Stopping Services

```bash
# Stop services
docker-compose -f docker-compose.production.yml stop prometheus grafana

# Stop and remove containers
docker-compose -f docker-compose.production.yml down prometheus grafana

# Stop and remove containers + volumes (⚠️ deletes data)
docker-compose -f docker-compose.production.yml down -v prometheus grafana
```

## Troubleshooting

### Docker Not Running

**Error:** `unable to get image` or `The system cannot find the file specified`

**Solution:**
1. Start Docker Desktop
2. Wait for Docker to fully start (whale icon in system tray)
3. Verify with: `docker ps`

### Port Already in Use

**Error:** `port is already allocated`

**Solution:**
```bash
# Check what's using the port
netstat -ano | findstr :9090  # Windows
lsof -i :9090                  # macOS/Linux

# Stop conflicting service or change port in docker-compose.production.yml
```

### Prometheus Can't Scrape Backend

**Issue:** No metrics appearing in Prometheus

**Solution:**
1. Ensure backend is running: `docker-compose -f docker-compose.production.yml ps backend`
2. Check backend metrics endpoint: `curl http://localhost:3001/metrics`
3. Verify network connectivity: Both services on same network (`app-network`)
4. Check Prometheus targets: http://localhost:9090/targets

### Grafana Can't Connect to Prometheus

**Issue:** "Data source not found" in Grafana

**Solution:**
1. Verify Prometheus is running: `docker ps | grep prometheus`
2. Check Prometheus URL in Grafana datasource config
3. Verify network: Both services on `app-network`
4. Check Grafana logs: `docker-compose -f docker-compose.production.yml logs grafana`

## Production Deployment

### Environment Variables

Create `.env` file in project root:

```env
# Database
DB_USER=postgres
DB_PASSWORD=your-secure-password
DB_NAME=saas_school

# JWT Secrets
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret

# Grafana
GRAFANA_PASSWORD=your-grafana-password

# API
API_BASE_URL=https://api.yourdomain.com
CORS_ORIGIN=https://yourdomain.com
```

### Security Considerations

1. **Change Grafana Password**
   - Set `GRAFANA_PASSWORD` in `.env`
   - Or change in Grafana UI after first login

2. **Protect Prometheus**
   - Add authentication (reverse proxy with auth)
   - Restrict network access
   - Use HTTPS

3. **Protect Metrics Endpoint**
   - Add authentication to `/metrics` endpoint
   - Use firewall rules
   - Monitor access logs

## Monitoring Backend Metrics

### View Metrics in Prometheus

1. Open http://localhost:9090
2. Go to **Graph** tab
3. Enter query: `http_requests_total`
4. Click **Execute**

### View Dashboard in Grafana

1. Open http://localhost:3000
2. Login (admin/admin)
3. Go to **Dashboards** → **Browse**
4. Select **Backend Metrics** dashboard

## Adding Custom Metrics

### Backend

Metrics are automatically collected via `metricsMiddleware`. To add custom metrics:

```typescript
import { metrics } from '../middleware/metrics';

// Increment counter
metrics.incrementApiCall('endpoint-name', 'tenant-id');

// Record gauge
metrics.setActiveUsers(tenantId, count);
```

### Frontend

```typescript
import { recordPerformanceMetric } from './lib/performance';

// Record custom metric
recordPerformanceMetric('custom_operation', duration, {
  operation: 'export',
  page: '/admin/reports'
});
```

## Maintenance

### Backup Data

```bash
# Backup Prometheus data
docker exec prometheus tar czf /tmp/prometheus-backup.tar.gz /prometheus

# Backup Grafana
docker exec grafana tar czf /tmp/grafana-backup.tar.gz /var/lib/grafana
```

### Update Services

```bash
# Pull latest images
docker-compose -f docker-compose.production.yml pull prometheus grafana

# Restart services
docker-compose -f docker-compose.production.yml up -d prometheus grafana
```

### Clean Up Old Data

```bash
# Prometheus retention is configured in prometheus.yml
# Default: 15 days (adjust as needed)
```

## Next Steps

1. **Configure Alerts**
   - Set up Alertmanager
   - Configure notification channels (email, Slack)
   - Test alert rules

2. **Custom Dashboards**
   - Create additional Grafana dashboards
   - Add business-specific metrics
   - Set up alerting rules

3. **Integration**
   - Connect to log aggregation (ELK stack)
   - Set up distributed tracing
   - Add APM tools

---

For more details, see:
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [cicd-hardening.md](../cicd-hardening.md)

