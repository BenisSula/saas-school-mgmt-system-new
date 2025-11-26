# Admin Dashboard Setup & Testing Guide

This guide provides step-by-step instructions for setting up and testing the admin dashboard locally, including role-based access control (RBAC) testing.

---

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 16+
- Git

---

## 1. Local Setup

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run database migrations
npm run migrate

# Start backend server
npm run dev
```

The backend will start on `http://localhost:3001`

### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# VITE_API_BASE_URL should point to http://localhost:3001

# Start frontend dev server
npm run dev
```

The frontend will start on `http://localhost:5173`

---

## 2. Database Setup

### Create Demo Tenant

The backend includes a demo tenant seeder. After running migrations:

```bash
# The demo tenant is automatically created if AUTO_SEED_DEMO=true in .env
# Or manually seed:
npm run seed:demo
```

### Demo Credentials

**Admin User**:
- Email: `admin@demo.school`
- Password: `DemoAdmin123!`

**Superuser**:
- Email: `superuser@platform.com`
- Password: `SuperUser123!`

**Teacher**:
- Email: `teacher@demo.school`
- Password: `DemoTeacher123!`

**Student**:
- Email: `student@demo.school`
- Password: `DemoStudent123!`

---

## 3. Testing Admin Dashboard

### Access Admin Dashboard

1. Navigate to `http://localhost:5173`
2. Login with admin credentials: `admin@demo.school` / `DemoAdmin123!`
3. You should be redirected to `/dashboard/admin/overview`

### Admin Dashboard Features

The admin dashboard includes:

- **Overview Page** (`/dashboard/admin/overview`)
  - Statistics cards (teachers, students, classes, subjects)
  - Charts (student growth, attendance trends, teacher activity)
  - Activity logs
  - Quick actions panel

- **User Management** (`/dashboard/admin/users`)
  - Create HOD, Teacher, Student
  - Enable/disable users
  - View user details

- **Classes Management** (`/dashboard/admin/classes`)
  - Create/edit/delete classes
  - Assign teachers to classes
  - Assign students to classes

- **Departments Management** (`/dashboard/admin/departments`)
  - Create/edit/delete departments
  - Assign HODs to departments

- **Reports** (`/dashboard/admin/reports`)
  - Activity reports
  - Login reports
  - Performance summaries

---

## 4. Testing RBAC (Role-Based Access Control)

### Test Admin Access

1. **Login as Admin**:
   ```bash
   Email: admin@demo.school
   Password: DemoAdmin123!
   ```

2. **Verify Access**:
   - ✅ Should access `/dashboard/admin/overview`
   - ✅ Should access `/dashboard/admin/users`
   - ✅ Should access `/dashboard/admin/classes`
   - ✅ Should access `/dashboard/admin/departments`
   - ✅ Should see "Create" buttons
   - ✅ Should see "Edit" and "Delete" buttons

3. **Verify Restrictions**:
   - ❌ Should NOT access `/dashboard/superuser/*`
   - ❌ Should NOT see superuser-only features

### Test Superuser Access

1. **Login as Superuser**:
   ```bash
   Email: superuser@platform.com
   Password: SuperUser123!
   ```

2. **Verify Access**:
   - ✅ Should access `/dashboard/superuser/overview`
   - ✅ Should access `/dashboard/superuser/schools`
   - ✅ Should access `/dashboard/superuser/users`
   - ✅ Should access all admin routes

### Test Teacher Access

1. **Login as Teacher**:
   ```bash
   Email: teacher@demo.school
   Password: DemoTeacher123!
   ```

2. **Verify Access**:
   - ✅ Should access `/dashboard/teacher/dashboard`
   - ✅ Should access `/dashboard/teacher/classes`
   - ✅ Should access `/dashboard/teacher/students`
   - ❌ Should NOT access `/dashboard/admin/*`
   - ❌ Should NOT see admin-only buttons

### Test Student Access

1. **Login as Student**:
   ```bash
   Email: student@demo.school
   Password: DemoStudent123!
   ```

2. **Verify Access**:
   - ✅ Should access `/dashboard/student/dashboard`
   - ✅ Should access `/dashboard/student/attendance`
   - ✅ Should access `/dashboard/student/results`
   - ❌ Should NOT access `/dashboard/admin/*`
   - ❌ Should NOT access `/dashboard/teacher/*`

---

## 5. Testing Permissions

### Permission-Based Access

The admin dashboard uses permission-based access control. Test the following:

1. **Users Management Permission** (`users:manage`):
   - Admin should see "Create HOD", "Create Teacher", "Create Student" buttons
   - Non-admin users should NOT see these buttons

2. **Classes Management Permission** (`settings:classes`):
   - Admin should see "Create Class" button
   - Admin should see "Edit" and "Delete" buttons in classes table
   - Non-admin users should NOT see these buttons

3. **Departments Management Permission** (`school:manage`):
   - Admin should see "Create Department" button
   - Admin should see "Edit" and "Delete" buttons in departments table
   - Non-admin users should NOT see these buttons

### Testing Permission Checks

1. **Open Browser DevTools** (F12)
2. **Navigate to Network tab**
3. **Try to access admin endpoint with non-admin token**:
   ```javascript
   // In browser console
   fetch('/api/admin/dashboard', {
     headers: {
       'Authorization': 'Bearer <non-admin-token>'
     }
   })
   ```
4. **Verify**: Should receive `403 Forbidden` response

---

## 6. Running Tests

### Backend Tests

```bash
cd backend
npm test
```

**Test Coverage**:
- RBAC middleware tests
- Authentication tests
- Route handler tests

### Frontend Tests

```bash
cd frontend
npm test
```

**Test Coverage**:
- Component tests
- Hook tests
- Integration tests

### E2E Tests

```bash
cd frontend
npm run test:e2e
```

**Test Coverage**:
- Login flow
- Admin dashboard navigation
- RBAC enforcement
- UI/UX audit

---

## 7. Performance Testing

### Bundle Analysis

```bash
cd frontend
npm run build
# Open dist/stats.html in browser for bundle visualization
```

### Performance Metrics

- **Initial Load**: ~450 KB
- **Largest Route**: 30.6 KB
- **Average Route**: ~8 KB
- **Total Bundle**: 1.14 MB

### Lighthouse Audit

1. Open `http://localhost:5173` in Chrome
2. Open DevTools (F12)
3. Go to Lighthouse tab
4. Run audit for Performance, Accessibility, Best Practices

**Target Scores**:
- Performance: >90
- Accessibility: >95
- Best Practices: >90

---

## 8. Troubleshooting

### Backend Not Starting

1. **Check database connection**:
   ```bash
   # Verify DATABASE_URL in .env
   # Test connection:
   psql $DATABASE_URL -c "SELECT 1"
   ```

2. **Check migrations**:
   ```bash
   npm run migrate
   ```

3. **Check logs**:
   ```bash
   # Backend logs should show:
   # "Backend server listening on port 3001"
   ```

### Frontend Not Connecting to Backend

1. **Check API base URL**:
   ```bash
   # In frontend/.env:
   VITE_API_BASE_URL=http://localhost:3001
   ```

2. **Check CORS settings**:
   ```bash
   # In backend/.env:
   CORS_ORIGIN=http://localhost:5173
   ```

3. **Check proxy settings**:
   ```bash
   # In frontend/vite.config.ts:
   # Proxy should forward /api to http://127.0.0.1:3001
   ```

### Permission Issues

1. **Check user role**:
   ```sql
   SELECT role FROM shared.users WHERE email = 'admin@demo.school';
   -- Should return 'admin'
   ```

2. **Check permissions**:
   ```typescript
   // In browser console:
   // Check if user has permission
   const { user } = useAuth();
   console.log(user.role); // Should be 'admin'
   ```

---

## 9. Development Workflow

### Making Changes

1. **Create feature branch**:
   ```bash
   git checkout -b feature/admin-dashboard-improvement
   ```

2. **Make changes**:
   - Edit files
   - Test locally
   - Run tests

3. **Commit changes**:
   ```bash
   git add .
   git commit -m "feat(admin): improve dashboard performance"
   ```

4. **Push and create PR**:
   ```bash
   git push origin feature/admin-dashboard-improvement
   ```

### Code Quality Checks

```bash
# Backend
cd backend
npm run lint
npm test

# Frontend
cd frontend
npm run lint
npm test
npm run test:e2e
```

---

## 10. Additional Resources

### Documentation

- [API Documentation](./docs/api/README.md)
- [RBAC Guide](./PROMPT8_RBAC_HARDENING_REPORT.md)
- [Performance Report](./PROMPT9_PERFORMANCE_OPTIMIZATION_REPORT.md)

### Reports

- `rbac_hardening_report.json` - RBAC analysis
- `performance_report.json` - Bundle analysis
- `ui_audit_report.json` - UI/UX analysis

### Support

For issues or questions:
1. Check existing documentation
2. Review test files for examples
3. Check GitHub issues
4. Contact development team

---

## 11. Quick Reference

### Common Commands

```bash
# Backend
cd backend
npm run dev          # Start dev server
npm test             # Run tests
npm run migrate      # Run migrations
npm run lint         # Lint code

# Frontend
cd frontend
npm run dev          # Start dev server
npm test             # Run tests
npm run test:e2e     # Run E2E tests
npm run build        # Build for production
npm run lint         # Lint code
```

### Common URLs

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3001`
- API Docs: `http://localhost:3001/api/docs` (if enabled)

---

**Last Updated**: 2025-11-26  
**Version**: 1.0.0

