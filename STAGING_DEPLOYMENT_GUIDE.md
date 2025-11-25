# Staging Deployment Guide

**Date:** 2025-11-24  
**Purpose:** Step-by-step guide for deploying to staging environment

## Prerequisites

- [ ] Backend code builds successfully (`npm run build` in backend/)
- [ ] Frontend code builds successfully (`npm run build` in frontend/)
- [ ] All environment variables configured
- [ ] Database migrations ready
- [ ] Docker installed (if using containers)
- [ ] Access to staging server/environment

## Pre-Deployment Checklist

### 1. Code Quality Verification
```bash
# Backend
cd backend
npm run lint
npm run build
npm test

# Frontend
cd frontend
npm run lint
npm run build
```

### 2. Security Scan
```bash
# Root directory
npm audit
npm audit fix

# Docker images (if applicable)
docker scan backend:latest
docker scan frontend:latest
```

### 3. Environment Configuration
- [ ] Copy `.env.example` to `.env.staging`
- [ ] Update all environment variables for staging
- [ ] Verify database connection strings
- [ ] Set JWT secrets (use strong, unique values)
- [ ] Configure CORS origins for staging domain
- [ ] Set up API keys and external service credentials

### 4. Database Preparation
```bash
# Backup existing staging database (if any)
pg_dump -h <staging-host> -U <user> -d <database> > staging_backup_$(date +%Y%m%d).sql

# Run migrations
cd backend
npm run migrate
```

## Deployment Methods

### Option 1: Docker Compose (Recommended for Staging)

#### Step 1: Build Images
```bash
# Build backend image
docker build -t backend:staging ./backend

# Build frontend image
docker build -t frontend:staging ./frontend
```

#### Step 2: Tag for Registry (if using)
```bash
docker tag backend:staging <registry>/backend:staging
docker tag frontend:staging <registry>/frontend:staging
docker push <registry>/backend:staging
docker push <registry>/frontend:staging
```

#### Step 3: Deploy
```bash
# Update docker-compose.production.yml with staging environment variables
docker-compose -f docker-compose.production.yml up -d
```

### Option 2: Direct Node.js Deployment

#### Step 1: Build Applications
```bash
# Backend
cd backend
npm install --production
npm run build

# Frontend
cd frontend
npm install --production
npm run build
```

#### Step 2: Start Services
```bash
# Backend (using PM2 or similar)
pm2 start backend/dist/server.js --name backend-staging

# Frontend (serve static files)
# Use nginx or similar to serve frontend/dist
```

### Option 3: Kubernetes Deployment

#### Step 1: Update Manifests
- Update `k8s/backend-deployment.yaml` with staging image tags
- Update `k8s/frontend-deployment.yaml` with staging image tags
- Update environment variables in ConfigMaps/Secrets

#### Step 2: Deploy
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
```

## Post-Deployment Verification

### 1. Health Checks
```bash
# Using verification script (PowerShell)
.\scripts\verify-deployment.ps1 -ApiUrl "https://api-staging.yourdomain.com" -FrontendUrl "https://staging.yourdomain.com"

# Or manually
curl https://api-staging.yourdomain.com/api/health
curl https://staging.yourdomain.com
```

### 2. Smoke Tests
- [ ] Login flow works
- [ ] Dashboard loads correctly
- [ ] Key features functional (students, teachers, classes)
- [ ] API endpoints responding
- [ ] Frontend assets loading

### 3. Load Testing
```bash
# Install K6 first (see load-testing/INSTALL_K6.md)
API_URL=https://api-staging.yourdomain.com \
TEST_EMAIL=admin@staging.com \
TEST_PASSWORD=staging-password \
k6 run load-testing/k6-load-test.js

# Or use Node.js alternative
API_URL=https://api-staging.yourdomain.com \
TEST_EMAIL=admin@staging.com \
TEST_PASSWORD=staging-password \
node load-testing/node-load-test.js
```

### 4. Monitoring Verification
- [ ] Prometheus metrics accessible
- [ ] Grafana dashboards loading
- [ ] Logs being collected
- [ ] Error tracking working (if configured)

## Rollback Procedure

If issues are detected:

### Docker Compose
```bash
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d <previous-version>
```

### Kubernetes
```bash
kubectl rollout undo deployment/backend -n staging
kubectl rollout undo deployment/frontend -n staging
```

### Database Rollback (if needed)
```bash
psql -h <staging-host> -U <user> -d <database> < staging_backup_<timestamp>.sql
```

## Monitoring Checklist

### First Hour
- [ ] Application health checks passing
- [ ] No critical errors in logs
- [ ] Response times acceptable
- [ ] Database connections stable

### First 24 Hours
- [ ] Error rates within acceptable range
- [ ] Performance metrics stable
- [ ] User authentication working
- [ ] Multi-tenant isolation verified

### First Week
- [ ] System stability confirmed
- [ ] Performance baselines established
- [ ] User feedback collected
- [ ] Documentation updated

## Common Issues & Solutions

### Issue: Backend not starting
- Check environment variables
- Verify database connectivity
- Review logs for errors
- Check port availability

### Issue: Frontend not loading
- Verify build output exists
- Check nginx/server configuration
- Verify API URL configuration
- Check browser console for errors

### Issue: Database connection errors
- Verify connection string
- Check database server status
- Verify user permissions
- Check network connectivity

### Issue: High error rates
- Review application logs
- Check database performance
- Verify external service connectivity
- Review resource limits

## Success Criteria

- ✅ All health checks passing
- ✅ Response times < 500ms (p95)
- ✅ Error rate < 1%
- ✅ All smoke tests passing
- ✅ Monitoring operational
- ✅ Load tests passing

## Next Steps After Staging

1. **Monitor for 24-48 hours**
2. **Collect user feedback**
3. **Address any issues found**
4. **Update production deployment checklist**
5. **Schedule production deployment**

---

**Note:** This guide assumes a staging environment similar to production. Adjust steps based on your specific infrastructure setup.

