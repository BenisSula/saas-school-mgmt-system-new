# Local Development Guide

This guide provides step-by-step instructions for setting up and running the SaaS School Management System locally.

## Prerequisites

- **Node.js**: v18+ (recommended: v20+)
- **PostgreSQL**: v14+ (recommended: v16+)
- **npm**: v9+ (comes with Node.js)
- **Git**: Latest version

### Optional but Recommended
- **Docker & Docker Compose**: For containerized development
- **Postman** or **curl**: For API testing

---

## Quick Start (Docker)

The fastest way to get started is using Docker Compose:

```bash
# Start all services (database, backend, frontend)
docker compose up --build

# Services will be available at:
# - Frontend: http://localhost:5173
# - Backend API: http://localhost:3001
# - PostgreSQL: localhost:5433
```

See [Docker Setup](#docker-setup) section for more details.

---

## Manual Setup

### Step 1: Clone and Install Dependencies

```bash
# Clone the repository (if you haven't already)
git clone <repository-url>
cd saas-school-mgmt-system

# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Step 2: Set Up PostgreSQL Database

#### Option A: Local PostgreSQL Installation

1. **Install PostgreSQL** (if not already installed):
   - **Windows**: Download from [postgresql.org](https://www.postgresql.org/download/windows/)
   - **macOS**: `brew install postgresql@16`
   - **Linux**: `sudo apt-get install postgresql-16` (Ubuntu/Debian)

2. **Start PostgreSQL Service**:
   ```bash
   # Windows (PowerShell as Administrator)
   Start-Service postgresql-x64-16
   
   # macOS
   brew services start postgresql@16
   
   # Linux
   sudo systemctl start postgresql
   ```

3. **Create Database**:
   ```bash
   # Connect to PostgreSQL
   psql -U postgres
   
   # Create database
   CREATE DATABASE saas_school;
   
   # Exit psql
   \q
   ```

4. **Verify Connection**:
   ```bash
   psql -U postgres -d saas_school -c "SELECT version();"
   ```

#### Option B: Docker (PostgreSQL Only)

```bash
# Start only PostgreSQL in Docker
docker run -d \
  --name saas-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=saas_school \
  -p 5432:5432 \
  postgres:16

# Verify it's running
docker ps | grep saas-postgres
```

### Step 3: Configure Backend Environment

1. **Create Backend `.env` File**:
   ```bash
   cd backend
   cp .env.example .env  # If .env.example exists
   # OR create manually (see below)
   ```

2. **Backend `.env` Template**:
   ```env
   # Server Configuration
   PORT=3001
   NODE_ENV=development

   # Database Configuration
   # For local PostgreSQL:
   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/saas_school
   
   # For Docker PostgreSQL:
   # DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/saas_school

   # JWT Configuration (IMPORTANT: Change these in production!)
   # Generate strong secrets: openssl rand -hex 32
   JWT_SECRET=your-secret-key-here-change-in-production
   JWT_REFRESH_SECRET=your-refresh-secret-key-here-change-in-production
   JWT_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d

   # CORS Configuration
   # Leave empty to use default dev origins
   # CORS_ORIGIN=http://localhost:5173,http://localhost:5174

   # Migration Configuration
   SKIP_MIGRATIONS=false

   # Demo Tenant Configuration (development only)
   AUTO_SEED_DEMO=true
   DEMO_TENANT_SCHEMA=tenant_demo_academy
   DEMO_SCHOOL_NAME=Demo Academy
   DEMO_ADMIN_EMAIL=admin.demo@academy.test
   DEMO_ADMIN_PASSWORD=AdminDemo#2025
   DEMO_TEACHER_EMAIL=teacher.demo@academy.test
   DEMO_TEACHER_PASSWORD=TeacherDemo#2025
   DEMO_STUDENT_EMAIL=student.demo@academy.test
   DEMO_STUDENT_PASSWORD=StudentDemo#2025
   DEMO_SUPER_EMAIL=owner.demo@platform.test
   DEMO_SUPER_PASSWORD=OwnerDemo#2025
   ```

3. **Generate Secure JWT Secrets** (recommended):
   ```bash
   # Generate random secrets
   openssl rand -hex 32  # For JWT_SECRET
   openssl rand -hex 32  # For JWT_REFRESH_SECRET
   ```

### Step 4: Run Database Migrations

```bash
cd backend

# Run migrations
npm run migrate

# Expected output:
# Running shared migrations...
# ✅ Shared migrations completed successfully.
# Running tenant migrations for all tenants...
# ✅ All tenant migrations completed successfully!
```

**Troubleshooting Migration Errors**:
- If migrations fail, check PostgreSQL is running: `psql -U postgres -c "SELECT 1;"`
- Verify DATABASE_URL in `.env` is correct
- Check database exists: `psql -U postgres -l | grep saas_school`

### Step 5: Start Backend Server

```bash
cd backend

# Development mode (with hot-reload)
npm run dev

# Expected output:
# [seed] Demo tenant ready. { ... }
# ✅ Session cleanup job started
# ✅ Platform metrics collection started
# Backend server listening on port 3001
```

**Verify Backend is Running**:
```bash
# In another terminal
curl http://127.0.0.1:3001/health

# Expected response:
# {"status":"ok","timestamp":"2025-11-26T..."}
```

### Step 6: Configure Frontend Environment

1. **Create Frontend `.env` File** (optional):
   ```bash
   cd frontend
   # Create .env file (or leave empty to use defaults)
   ```

2. **Frontend `.env` Template** (optional):
   ```env
   # API Configuration
   # Leave unset to use Vite proxy (/api) - Recommended for development
   # VITE_API_BASE_URL=/api

   # For direct API calls (bypass proxy):
   # VITE_API_BASE_URL=http://127.0.0.1:3001/api

   # Docker Environment
   # DOCKER_CONTAINER=false
   ```

   **Note**: For local development, you can leave this file empty. The frontend will default to using `/api` which is proxied to `http://127.0.0.1:3001` by Vite.

### Step 7: Start Frontend Server

```bash
cd frontend

# Development mode (with hot-reload)
npm run dev

# Expected output:
#   VITE v7.1.7  ready in xxx ms
#   ➜  Local:   http://localhost:5173/
#   ➜  Network: use --host to expose
```

**Verify Frontend is Running**:
- Open browser: `http://localhost:5173`
- You should see the landing page or login page

---

## Testing the Setup

### 1. Test Backend Health

```bash
curl http://127.0.0.1:3001/health
# Expected: {"status":"ok","timestamp":"..."}

curl http://127.0.0.1:3001/health/detailed
# Expected: Detailed health status with DB connection
```

### 2. Test Login Endpoint

```bash
# Test with demo admin credentials
curl -X POST http://127.0.0.1:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin.demo@academy.test","password":"AdminDemo#2025"}'

# Expected: JSON with accessToken, refreshToken, and user object
```

### 3. Test Frontend Connection

1. Open browser: `http://localhost:5173`
2. Open DevTools → Network tab
3. Navigate to login page
4. Try logging in with demo credentials:
   - **Admin**: `admin.demo@academy.test` / `AdminDemo#2025`
   - **Teacher**: `teacher.demo@academy.test` / `TeacherDemo#2025`
   - **Student**: `student.demo@academy.test` / `StudentDemo#2025`
   - **Superuser**: `owner.demo@platform.test` / `OwnerDemo#2025`

### 4. Run Integration Test

```bash
cd backend

# Run all tests
npm test

# Run specific integration test
npm test -- auth.test.ts

# Watch mode
npm run test:watch
```

---

## Docker Setup

### Full Stack (Database + Backend + Frontend)

```bash
# Start all services
docker compose up --build

# Start in detached mode (background)
docker compose up -d --build

# View logs
docker compose logs -f

# Stop all services
docker compose down

# Stop and remove volumes (WARNING: Deletes database data)
docker compose down -v
```

### Services

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001
- **PostgreSQL**: localhost:5433 (external), 5432 (internal)

### Environment Variables

Docker Compose uses environment variables from `docker-compose.yml`. To override:

1. Create `docker-compose.override.yml` (gitignored):
   ```yaml
   version: '3.9'
   services:
     backend:
       environment:
         JWT_SECRET: your-custom-secret
     frontend:
       environment:
         VITE_API_BASE_URL: http://backend:3001
   ```

2. Or use `.env` file (create in root directory):
   ```env
   JWT_SECRET=your-secret
   DATABASE_URL=postgres://...
   ```

### Troubleshooting Docker

**Issue: Port already in use**
```bash
# Check what's using the port
# Windows
netstat -ano | findstr :3001
# Linux/Mac
lsof -i :3001

# Stop the conflicting service or change port in docker-compose.yml
```

**Issue: Database connection fails**
```bash
# Check if database container is running
docker compose ps

# Check database logs
docker compose logs db

# Restart database
docker compose restart db
```

**Issue: Backend migrations fail**
```bash
# Access backend container
docker compose exec backend bash

# Run migrations manually
npm run migrate

# Check database connection
psql $DATABASE_URL -c "SELECT 1;"
```

---

## Demo Accounts

After starting the backend with `AUTO_SEED_DEMO=true`, the following demo accounts are available:

| Role | Email | Password | Access |
|------|-------|----------|--------|
| **Superuser** | `owner.demo@platform.test` | `OwnerDemo#2025` | Platform administration |
| **Admin** | `admin.demo@academy.test` | `AdminDemo#2025` | School administration |
| **Teacher** | `teacher.demo@academy.test` | `TeacherDemo#2025` | Teacher dashboard |
| **Student** | `student.demo@academy.test` | `StudentDemo#2025` | Student portal |

**Note**: All demo accounts are marked as `active` and `verified`, so they can log in immediately.

---

## Development Workflow

### Backend Development

```bash
cd backend

# Run in development mode (auto-reload on file changes)
npm run dev

# Run migrations
npm run migrate

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format:write
```

### Frontend Development

```bash
cd frontend

# Run in development mode (auto-reload on file changes)
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format:write

# Build for production
npm run build

# Preview production build
npm run preview
```

### Database Operations

```bash
cd backend

# Run migrations
npm run migrate

# Seed demo tenant manually
npm run demo:seed

# Reset database (WARNING: Deletes all data)
# Drop and recreate database, then run migrations
psql -U postgres -c "DROP DATABASE saas_school;"
psql -U postgres -c "CREATE DATABASE saas_school;"
npm run migrate
```

---

## Common Issues & Solutions

### Backend Issues

**Issue: Port 3001 already in use**
```bash
# Find process using port
# Windows
netstat -ano | findstr :3001
# Kill process (replace PID)
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3001
kill -9 <PID>

# Or change port in backend/.env
PORT=3002
```

**Issue: Database connection refused**
```bash
# Check PostgreSQL is running
# Windows
Get-Service postgresql*

# Linux/Mac
sudo systemctl status postgresql

# Verify DATABASE_URL
echo $DATABASE_URL  # or check backend/.env

# Test connection
psql $DATABASE_URL -c "SELECT 1;"
```

**Issue: Migration errors**
- Ensure PostgreSQL is running
- Verify database exists: `psql -U postgres -l`
- Check DATABASE_URL is correct
- Try skipping migrations temporarily: `SKIP_MIGRATIONS=true`

### Frontend Issues

**Issue: Port 5173 already in use**
- Vite will automatically try the next available port (5174, 5175, etc.)
- Or kill the process using port 5173

**Issue: CORS errors**
- Ensure backend is running
- Check CORS_ORIGIN in backend/.env includes frontend origin
- Verify Vite proxy is working (check Network tab in DevTools)

**Issue: API calls fail**
- Check backend is running: `curl http://127.0.0.1:3001/health`
- Verify VITE_API_BASE_URL (should be `/api` for proxy or `http://127.0.0.1:3001/api` for direct)
- Check Network tab in DevTools for error details

### Docker Issues

See [Troubleshooting Docker](#troubleshooting-docker) section above.

---

## Environment Variables Reference

### Backend Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3001` | Backend server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `DATABASE_URL` | **Yes** | - | PostgreSQL connection string |
| `JWT_SECRET` | **Yes** | - | Secret for access tokens |
| `JWT_REFRESH_SECRET` | **Yes** | - | Secret for refresh tokens |
| `JWT_EXPIRES_IN` | No | `15m` | Access token expiration |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token expiration |
| `CORS_ORIGIN` | No | Default dev origins | Allowed CORS origins |
| `SKIP_MIGRATIONS` | No | `false` | Skip migrations at startup |
| `AUTO_SEED_DEMO` | No | `true` (dev) | Auto-seed demo tenant |

### Frontend Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_BASE_URL` | No | `/api` | API base URL (uses Vite proxy) |
| `DOCKER_CONTAINER` | No | `false` | Indicates Docker environment |

---

## Next Steps

- Read the main [README.md](./README.md) for project overview
- Check [docs/](./docs/) for additional documentation
- Review [CHANGELOG.md](./CHANGELOG.md) for recent changes
- See [docs/deployment-checklist.md](./docs/deployment-checklist.md) before deploying

---

## Getting Help

- Check existing GitHub issues
- Review documentation in `docs/` directory
- Check backend/frontend logs for error messages
- Verify all prerequisites are installed correctly

---

**Happy Coding! 🚀**

