# Production Deployment Guide

**Last Updated:** January 2025

---

## Prerequisites

### Required Services
- PostgreSQL 14+
- Node.js 20.x
- Docker & Docker Compose (for monitoring stack)
- Prometheus (via Docker)
- Grafana (via Docker)
- Alertmanager (via Docker)

### Required Environment Variables

```bash
# Application
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:password@host:5432/database

# Security
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
CSRF_SECRET=your-csrf-secret

# Error Tracking (Sentry)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Monitoring
PROMETHEUS_ENABLED=true

# Alerting
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
PAGERDUTY_SERVICE_KEY=your-pagerduty-key
SMTP_USERNAME=your-smtp-user
SMTP_PASSWORD=your-smtp-password

# Grafana
GRAFANA_PASSWORD=your-secure-password
```

---

## Deployment Steps

### 1. Install Dependencies

```bash
# Backend
cd backend
npm ci --production

# Frontend
cd ../frontend
npm ci --production
npm run build
```

### 2. Database Setup

```bash
# Run migrations
cd backend
npm run migrate

# Verify database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM shared.tenants;"
```

### 3. Start Monitoring Stack

```bash
# Start Prometheus, Grafana, Alertmanager
docker-compose -f docker-compose.monitoring.yml up -d

# Verify services
curl http://localhost:9090/-/healthy  # Prometheus
curl http://localhost:3001/api/health # Grafana
curl http://localhost:9093/-/healthy  # Alertmanager
```

### 4. Start Application

```bash
# Backend
cd backend
npm start

# Frontend (if serving separately)
cd frontend
npm run preview
```

### 5. Verify Deployment

```bash
# Health check
curl http://localhost:3000/health

# Metrics endpoint
curl http://localhost:3000/metrics

# Detailed health
curl http://localhost:3000/health/detailed
```

---

## Monitoring Setup

### Grafana Configuration

1. **Login to Grafana**
   - URL: http://localhost:3001
   - Username: `admin`
   - Password: Set via `GRAFANA_PASSWORD`

2. **Add Prometheus Data Source**
   - Go to Configuration → Data Sources
   - Add Prometheus
   - URL: `http://prometheus:9090`
   - Save & Test

3. **Import Dashboards**
   - Go to Dashboards → Import
   - Upload `monitoring/grafana/dashboards/backend-overview.json`
   - Select Prometheus data source
   - Import

### Alertmanager Configuration

1. **Configure Slack Integration**
   - Set `SLACK_WEBHOOK_URL` environment variable
   - Restart Alertmanager

2. **Configure Email**
   - Set `SMTP_USERNAME` and `SMTP_PASSWORD`
   - Update `alertmanager.yml` with SMTP settings

3. **Test Alerts**
   - Trigger test alert via Prometheus
   - Verify routing to Slack/Email

---

## Health Check Endpoints

### Basic Health
```bash
GET /health
Response: { "status": "ok", "timestamp": "..." }
```

### Detailed Health
```bash
GET /health/detailed
Response: {
  "status": "healthy|degraded|unhealthy",
  "checks": { ... },
  "metrics": { ... }
}
```

### Kubernetes Probes
```bash
GET /health/ready  # Readiness probe
GET /health/live  # Liveness probe
```

---

## Metrics Endpoint

### Prometheus Scraping
```bash
GET /metrics
Content-Type: text/plain; version=0.0.4

# Exposes all Prometheus metrics
```

### Key Metrics
- `http_request_duration_seconds` - Request latency
- `http_requests_total` - Request count
- `active_users_total` - Active users
- `database_query_duration_seconds` - DB performance
- `errors_total` - Error count

---

## Incident Response

### Webhook Endpoint
```bash
POST /incident-response/webhook
Content-Type: application/json

{
  "alerts": [
    {
      "alertname": "HighErrorRate",
      "severity": "critical",
      "component": "backend",
      "summary": "High error rate detected",
      "description": "...",
      "status": "firing",
      "labels": { ... }
    }
  ]
}
```

### Automatic Actions
- Creates incident in status page system
- Logs to error tracking (Sentry)
- Sends notifications (if configured)

---

## CI/CD Pipeline

### GitHub Actions Workflow

The production pipeline includes:

1. **Test & Lint**
   - Runs on every push/PR
   - Tests backend and frontend
   - Uploads coverage

2. **Security Scan**
   - Trivy vulnerability scanning
   - Uploads to GitHub Security

3. **Build**
   - Builds Docker images
   - Pushes to container registry
   - Only on main/production branches

4. **Deploy**
   - Staging: Automatic on main branch
   - Production: Manual approval required

5. **Post-Deployment**
   - Smoke tests
   - Health check verification
   - Metrics endpoint check

---

## Monitoring Best Practices

### 1. Set Up Dashboards
- Import all Grafana dashboards
- Customize for your environment
- Set up alert rules

### 2. Configure Alerting
- Set up Slack channels
- Configure PagerDuty (for critical alerts)
- Set up email notifications
- Test alert routing

### 3. Log Aggregation
- Deploy OpenSearch/ELK stack
- Configure log shipping
- Set up log retention policies
- Create log-based alerts

### 4. Error Tracking
- Configure Sentry DSN
- Set up alert rules in Sentry
- Configure release tracking
- Set up user context

### 5. Regular Reviews
- Review dashboards weekly
- Analyze error trends
- Review alert effectiveness
- Optimize alert thresholds

---

## Troubleshooting

### Metrics Not Appearing
1. Check `/metrics` endpoint is accessible
2. Verify Prometheus can scrape backend
3. Check Prometheus targets page
4. Review Prometheus logs

### Alerts Not Firing
1. Verify alert rules syntax
2. Check Prometheus alert evaluation
3. Verify Alertmanager configuration
4. Test webhook endpoint

### Health Checks Failing
1. Check database connectivity
2. Verify all services are running
3. Review health check logs
4. Check system resources

### High Error Rate
1. Check Sentry for error details
2. Review application logs
3. Check database performance
4. Review recent deployments

---

## Security Considerations

### Metrics Endpoint
- **Production:** Protect `/metrics` endpoint
- Use authentication or IP whitelisting
- Consider rate limiting

### Health Endpoints
- `/health` can be public (for load balancers)
- `/health/detailed` should be protected
- Use authentication for sensitive info

### Logging
- Don't log sensitive data (passwords, tokens)
- Use structured logging
- Set appropriate log levels
- Implement log retention policies

### Error Tracking
- Configure Sentry data scrubbing
- Don't send PII to Sentry
- Use environment-specific DSNs
- Set up alert rules

---

## Performance Optimization

### Metrics Collection
- Use histogram buckets appropriately
- Avoid high-cardinality labels
- Aggregate metrics where possible
- Monitor Prometheus storage

### Logging
- Use appropriate log levels
- Avoid logging in hot paths
- Implement log sampling for high-volume
- Use async logging where possible

### Health Checks
- Keep health checks fast (<100ms)
- Cache expensive checks
- Use background health monitoring
- Don't block on health checks

---

## Maintenance

### Weekly Tasks
- Review dashboards
- Check alert effectiveness
- Review error trends
- Update documentation

### Monthly Tasks
- Review and optimize alert thresholds
- Analyze metrics retention
- Review log retention policies
- Update monitoring stack

### Quarterly Tasks
- Review monitoring architecture
- Optimize Prometheus storage
- Update Grafana dashboards
- Review incident response procedures

---

## Support

For issues or questions:
1. Check monitoring dashboards
2. Review application logs
3. Check Sentry for errors
4. Review Prometheus alerts
5. Contact DevOps team

---

**Status:** Production-ready monitoring and alerting infrastructure deployed.

