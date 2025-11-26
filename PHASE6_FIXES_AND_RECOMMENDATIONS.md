# PHASE 6 — Fixes and Mitigation Suggestions

## ✅ PHASE 6 COMPLETE

### Status: Configuration Verified - Recommendations Documented

---

## Current Configuration Status

Based on Phases 1-5 findings, the current configuration is **working correctly**. However, the following recommendations and fixes are provided for different environments and potential issues.

---

## 1. Backend Server Binding

### Current Status ✅
- **Binding**: `server.listen(currentPort)` defaults to `0.0.0.0` (all interfaces)
- **Status**: ✅ Correct for development and production
- **Verification**: Server accessible from localhost and network

### Recommended Fix (Explicit Binding)

**File**: `backend/src/server.ts:30`

**Current**:
```typescript
server.listen(currentPort, () => {
  console.log(`Backend server listening on port ${currentPort}`);
});
```

**Recommendation**: Make binding explicit for clarity (optional, current is fine):
```typescript
server.listen(currentPort, '0.0.0.0', () => {
  console.log(`Backend server listening on 0.0.0.0:${currentPort}`);
});
```

**When to Apply**: Only if you need explicit control or are debugging network binding issues.

**Status**: ⚠️ Optional - current implementation is correct

---

## 2. Database Connectivity Configuration

### Current Status ✅
- **Database**: PostgreSQL accessible on port 5432
- **Connection**: Working correctly
- **Migrations**: Running successfully

### Recommended Configuration

**File**: `backend/.env`

**Example Configuration** (create if doesn't exist):
```env
# Database Configuration
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/saas_school

# For Docker Compose (if backend runs on host, DB in container):
# DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/saas_school

# For Docker (both in same network):
# DATABASE_URL=postgres://postgres:postgres@db:5432/saas_school

# Skip migrations (for development/testing only)
# SKIP_MIGRATIONS=false

# Auto-seed demo tenant (development only)
# AUTO_SEED_DEMO=true
```

**Common Issues & Fixes**:

#### Issue: Connection Refused (ECONNREFUSED)
**Fix**: Ensure PostgreSQL is running
```bash
# Check if PostgreSQL is running
# Windows: Check Services or Task Manager
# Linux/Mac: sudo systemctl status postgresql
```

#### Issue: Password Authentication Failed (28P01)
**Fix**: Reset PostgreSQL password or update .env
```sql
-- In PostgreSQL:
ALTER USER postgres WITH PASSWORD 'postgres';
```

**Status**: ✅ Working - configuration examples provided

---

## 3. Vite Proxy Configuration

### Current Status ✅
- **Proxy Target**: `http://127.0.0.1:3001`
- **Proxy Path**: `/api`
- **Status**: Working correctly
- **Docker Detection**: Not needed (running locally)

### Recommended Configuration

**File**: `frontend/.env` (create if needed)

**Option 1: Use Proxy (Recommended for Development)**
```env
# Not required - defaults to /api (uses Vite proxy)
# VITE_API_BASE_URL=/api
```

**Option 2: Direct API Calls (Bypass Proxy)**
```env
# For direct API calls (requires CORS configuration)
VITE_API_BASE_URL=http://127.0.0.1:3001/api
```

**Option 3: Docker Environment**
```env
# If frontend runs in Docker and backend in container:
VITE_API_BASE_URL=http://backend:3001/api

# Or if backend accessible from host browser:
VITE_API_BASE_URL=http://127.0.0.1:3001/api
```

### Docker Detection Fix (if needed)

**File**: `frontend/vite.config.ts`

**Current**: No Docker detection logic (correct for local development)

**If Docker Detection Required**: Add to `vite.config.ts`:
```typescript
const isDocker = process.env.DOCKER_CONTAINER === 'true' || 
                 fs.existsSync('/.dockerenv');

const backendTarget = isDocker 
  ? 'http://backend:3001'  // Docker service name
  : 'http://127.0.0.1:3001'; // Local development

proxy: {
  '/api': {
    target: backendTarget,
    // ... rest of config
  }
}
```

**Status**: ✅ Working - optional Docker config provided

---

## 4. CORS Configuration

### Current Status ✅
- **Default Origins**: Includes `http://localhost:5173`
- **Dynamic Detection**: Allows localhost with dev ports
- **CORS Headers**: Present and correct

### Recommended Configuration

**File**: `backend/.env`

**Current**: Uses default dev origins (correct)

**Explicit Configuration** (if needed):
```env
# CORS Configuration
# Comma-separated list of allowed origins
CORS_ORIGIN=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173

# For production:
# CORS_ORIGIN=https://app.example.com,https://admin.example.com
```

### Code Location
**File**: `backend/src/app.ts:86-122`

**Current Behavior**:
- If `CORS_ORIGIN` is set, uses those origins
- Otherwise, uses default dev origins
- Dynamically allows localhost with dev ports

**Status**: ✅ Working correctly - explicit config optional

---

## 5. Health Check Endpoints

### Current Status ✅
- **Basic Health**: `GET /health` ✅
- **Detailed Health**: `GET /health/detailed` ✅
- **Readiness Probe**: `GET /health/ready` ✅
- **Liveness Probe**: `GET /health/live` ✅
- **Auth Health**: `GET /auth/health` ✅ (includes DB check)

### Health Check Implementation

**Files**:
- `backend/src/routes/health.ts` - Main health endpoints
- `backend/src/routes/auth.ts:43` - Auth-specific health with DB check
- `backend/src/services/monitoring/healthService.ts` - Health service

**Current Endpoints**:

#### 1. Basic Health Check
```http
GET /health
Response: { "status": "ok", "timestamp": "..." }
```

#### 2. Detailed Health Check
```http
GET /health/detailed
Response: {
  "status": "healthy" | "degraded" | "unhealthy",
  "database": { "status": "connected" | "disconnected" },
  "services": { ... },
  "timestamp": "..."
}
```

#### 3. Readiness Probe (Kubernetes)
```http
GET /health/ready
Response: {
  "ready": true | false,
  "checks": { ... },
  "timestamp": "..."
}
```

#### 4. Liveness Probe (Kubernetes)
```http
GET /health/live
Response: {
  "alive": true,
  "uptime": "...",
  "timestamp": "..."
}
```

#### 5. Auth Health Check (with DB)
```http
GET /auth/health
Response: {
  "status": "ok",
  "db": "ok",
  "timestamp": "..."
}
```

### Recommendations for CI/CD

**Add to CI/CD Pipeline**:
```yaml
# Example GitHub Actions
- name: Check Backend Health
  run: |
    curl -f http://localhost:3001/health || exit 1
    curl -f http://localhost:3001/health/ready || exit 1

# Example Docker Compose
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

**Status**: ✅ Complete - all health endpoints implemented

---

## 6. Environment Variable Examples

### Backend `.env.example`

**Recommended File**: `backend/.env.example`

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/saas_school

# JWT Configuration
JWT_SECRET=your-secret-key-here-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key-here-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS Configuration
CORS_ORIGIN=http://localhost:5173,http://localhost:5174

# Migration Configuration
SKIP_MIGRATIONS=false

# Demo Tenant Configuration
AUTO_SEED_DEMO=true
DEMO_TENANT_SCHEMA=tenant_demo_academy
DEMO_SCHOOL_NAME=Demo Academy
DEMO_ADMIN_EMAIL=admin.demo@academy.test
DEMO_ADMIN_PASSWORD=AdminDemo#2025

# Error Tracking (optional)
SENTRY_DSN=

# Session Configuration
SESSION_SECRET=your-session-secret-here
```

### Frontend `.env.example`

**Recommended File**: `frontend/.env.example`

```env
# API Configuration
# Leave unset to use Vite proxy (/api)
# VITE_API_BASE_URL=/api

# For direct API calls (bypass proxy):
# VITE_API_BASE_URL=http://127.0.0.1:3001/api

# Docker Environment
# DOCKER_CONTAINER=false
```

**Status**: 📝 Recommended - create these files for documentation

---

## 7. Common Issues & Fixes

### Issue 1: Backend Fails to Start - DB Connection Error

**Symptoms**:
```
❌ Failed to start server due to DB connection error
Error code: ECONNREFUSED or 28P01
```

**Fixes**:

1. **Check PostgreSQL is Running**:
   ```bash
   # Windows (PowerShell)
   Get-Service -Name postgresql*
   
   # Linux/Mac
   sudo systemctl status postgresql
   ```

2. **Verify DATABASE_URL**:
   ```env
   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/saas_school
   ```

3. **Reset PostgreSQL Password**:
   ```sql
   ALTER USER postgres WITH PASSWORD 'postgres';
   ```

4. **Test Connection**:
   ```bash
   psql 'postgres://postgres:postgres@127.0.0.1:5432/saas_school' -c '\dt'
   ```

### Issue 2: Vite Proxy Fails - Backend Unreachable

**Symptoms**:
```
[Vite Proxy] Error: connect ECONNREFUSED 127.0.0.1:3001
```

**Fixes**:

1. **Check Backend is Running**:
   ```bash
   curl http://127.0.0.1:3001/health
   ```

2. **Verify Proxy Target**:
   ```typescript
   // frontend/vite.config.ts
   proxy: {
     '/api': {
       target: 'http://127.0.0.1:3001', // Verify this matches backend port
       // ...
     }
   }
   ```

3. **Use Direct API Calls**:
   ```env
   # frontend/.env
   VITE_API_BASE_URL=http://127.0.0.1:3001/api
   ```

### Issue 3: CORS Error in Browser

**Symptoms**:
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

**Fixes**:

1. **Add Origin to CORS_ORIGIN**:
   ```env
   # backend/.env
   CORS_ORIGIN=http://localhost:5173,http://localhost:3000
   ```

2. **Restart Backend**:
   ```bash
   npm run dev  # or npm run start
   ```

3. **Verify Default Origins** (for development):
   - Default includes `http://localhost:5173`
   - Check `backend/src/app.ts:86-93`

### Issue 4: Backend Binds but Unreachable from Host

**Symptoms**:
- Backend starts successfully
- `curl localhost:3001/health` works
- `curl <host-ip>:3001/health` fails

**Fixes**:

1. **Verify Binding**:
   ```typescript
   // backend/src/server.ts
   server.listen(currentPort, '0.0.0.0', () => {
     // Explicitly bind to all interfaces
   });
   ```

2. **Check Firewall**:
   ```bash
   # Windows
   netsh advfirewall firewall show rule name="Port 3001"
   
   # Linux
   sudo ufw status
   ```

3. **Docker Network**:
   ```yaml
   # docker-compose.yml
   ports:
     - "3001:3001"  # Host:Container
   ```

### Issue 5: Migration Errors

**Symptoms**:
```
Migration failed in 033_consolidate_class_resources.sql: ...
```

**Fixes**:

1. **Skip Migrations Temporarily**:
   ```env
   SKIP_MIGRATIONS=true
   ```

2. **Run Migrations Manually**:
   ```bash
   cd backend
   npm run migrate
   ```

3. **Check Migration Files**:
   - Verify SQL syntax
   - Check for placeholder issues (`{{schema}}` for tenant migrations)
   - Ensure DO blocks are properly formatted

**Status**: ✅ Documented common issues and fixes

---

## 8. Production Recommendations

### Security Hardening

1. **Environment Variables**:
   - Use strong JWT secrets (generate with `openssl rand -hex 32`)
   - Set secure `SESSION_SECRET`
   - Never commit `.env` files

2. **CORS**:
   - Set explicit `CORS_ORIGIN` with production domains only
   - Remove default dev origins in production

3. **Database**:
   - Use connection pooling
   - Enable SSL for production database connections
   - Use environment-specific database credentials

4. **Server Binding**:
   - Bind to specific interface if needed (`0.0.0.0` for all is fine)
   - Use reverse proxy (nginx/traefik) in front

### Monitoring

1. **Health Checks**:
   - Monitor `/health/detailed` endpoint
   - Set up alerts for unhealthy status
   - Use `/health/ready` for Kubernetes readiness

2. **Logging**:
   - Enable structured logging
   - Set up log aggregation
   - Monitor error rates

3. **Metrics**:
   - Use `/metrics` endpoint (if implemented)
   - Track request rates, response times
   - Monitor database connection pool

**Status**: 📝 Recommendations for production deployment

---

## Summary

### ✅ Current Status
1. ✅ Backend binding correct (0.0.0.0 by default)
2. ✅ Database connectivity working
3. ✅ Vite proxy configured correctly
4. ✅ CORS configuration working
5. ✅ Health checks implemented

### 📝 Recommendations
1. 📝 Create `.env.example` files for documentation
2. ⚠️ Optional: Make server binding explicit (current is fine)
3. 📝 Add Docker detection if needed (not required currently)
4. 📝 Document environment variables
5. 📝 Add CI/CD health check examples

### 🎯 No Immediate Fixes Required
All configurations are working correctly. The recommendations above are for:
- **Documentation**: Example `.env` files
- **Future Environments**: Docker/production configurations
- **Troubleshooting**: Common issues and fixes
- **Best Practices**: Production recommendations

---

**PHASE 6 Status: ✅ COMPLETE**

**Configuration: ✅ VERIFIED AND DOCUMENTED**

**Action Items**: Optional improvements for documentation and production readiness.

