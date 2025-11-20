# Monitoring Stack Documentation

This directory contains all configuration files for the production monitoring stack.

## Structure

```
monitoring/
├── prometheus/
│   ├── prometheus.yml      # Prometheus configuration
│   └── alerts.yml          # Alert rules
├── grafana/
│   └── dashboards/
│       └── backend-overview.json  # Backend API dashboard
├── alertmanager/
│   └── alertmanager.yml    # Alert routing configuration
└── README.md               # This file
```

## Quick Start

### Start Monitoring Stack

```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

### Access Services

- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:3001 (admin/admin by default)
- **Alertmanager:** http://localhost:9093

### Verify Services

```bash
# Prometheus
curl http://localhost:9090/-/healthy

# Grafana
curl http://localhost:3001/api/health

# Alertmanager
curl http://localhost:9093/-/healthy
```

## Configuration

### Prometheus

Edit `prometheus/prometheus.yml` to:
- Add new scrape targets
- Modify scrape intervals
- Add external labels

### Alert Rules

Edit `prometheus/alerts.yml` to:
- Add new alert rules
- Modify thresholds
- Add alert groups

### Alertmanager

Edit `alertmanager/alertmanager.yml` to:
- Configure notification channels
- Set up routing rules
- Configure inhibition rules

### Grafana Dashboards

Import dashboards from `grafana/dashboards/`:
1. Login to Grafana
2. Go to Dashboards → Import
3. Upload JSON file
4. Select Prometheus data source

## Metrics Endpoints

### Backend API
- Endpoint: `http://backend:3000/metrics`
- Format: Prometheus text format
- Scrape interval: 15s

### Node Exporter
- Endpoint: `http://node-exporter:9100/metrics`
- System metrics (CPU, memory, disk, network)

### PostgreSQL Exporter
- Endpoint: `http://postgres-exporter:9187/metrics`
- Database metrics (connections, queries, performance)

## Alerting

### Alert Channels

1. **Slack**
   - Channel: `#alerts-critical` (critical alerts)
   - Channel: `#alerts-database` (database alerts)
   - Channel: `#alerts-infrastructure` (infrastructure alerts)
   - Channel: `#alerts-security` (security alerts)

2. **Email**
   - Database team: `database-team@example.com`
   - Security team: `security-team@example.com`

3. **PagerDuty**
   - Critical alerts only
   - Requires `PAGERDUTY_SERVICE_KEY`

4. **Webhook**
   - Incident response automation
   - Endpoint: `http://backend:3000/incident-response/webhook`

### Alert Severities

- **Critical:** Immediate notification, PagerDuty integration
- **Warning:** Grouped notifications, 30s wait
- **Info:** Logged only, no immediate notification

## Dashboards

### Backend API Overview

**Panels:**
- Request rate (requests/sec)
- Response time (95th percentile)
- Error rate (errors/sec)
- Active users
- Database query duration
- Memory usage

**Refresh:** 30 seconds
**Time Range:** Last 1 hour (default)

## Troubleshooting

### Prometheus Not Scraping

1. Check target status: http://localhost:9090/targets
2. Verify network connectivity
3. Check scrape configuration
4. Review Prometheus logs: `docker logs prometheus`

### Alerts Not Firing

1. Check alert rules syntax
2. Verify Prometheus can evaluate rules
3. Check Alertmanager configuration
4. Review Alertmanager logs: `docker logs alertmanager`

### Grafana No Data

1. Verify Prometheus data source
2. Check query syntax
3. Verify time range
4. Check Prometheus has data

## Production Considerations

### Security

- Protect Grafana with authentication
- Use HTTPS for all services
- Restrict Prometheus access
- Use secrets for sensitive config

### Performance

- Monitor Prometheus storage growth
- Set appropriate retention periods
- Use recording rules for expensive queries
- Optimize scrape intervals

### High Availability

- Run Prometheus in HA mode
- Use Alertmanager clustering
- Backup Grafana dashboards
- Monitor monitoring stack itself

## Maintenance

### Backup

```bash
# Backup Prometheus data
docker exec prometheus tar czf /tmp/prometheus-backup.tar.gz /prometheus

# Backup Grafana
docker exec grafana tar czf /tmp/grafana-backup.tar.gz /var/lib/grafana
```

### Updates

```bash
# Update Prometheus
docker-compose -f docker-compose.monitoring.yml pull prometheus
docker-compose -f docker-compose.monitoring.yml up -d prometheus

# Update Grafana
docker-compose -f docker-compose.monitoring.yml pull grafana
docker-compose -f docker-compose.monitoring.yml up -d grafana
```

### Cleanup

```bash
# Remove old Prometheus data (careful!)
docker exec prometheus rm -rf /prometheus/*

# Clean up old metrics (set retention in prometheus.yml)
```

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)

