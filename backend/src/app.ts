import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import tenantsRouter from './routes/tenants';
import studentsRouter from './routes/students';
import teachersRouter from './routes/teachers';
import brandingRouter from './routes/branding';
import schoolRouter from './routes/school';
import attendanceRouter from './routes/attendance';
import examsRouter from './routes/exams';
import gradesRouter from './routes/grades';
import resultsRouter from './routes/results';
import invoicesRouter from './routes/invoices';
import paymentsRouter from './routes/payments';
import configurationRouter from './routes/configuration';
import reportsRouter from './routes/reports';
import superuserRouter from './routes/superuser';
import usersRouter from './routes/users';
import teacherRouter from './routes/teacher';
import adminAcademicsRouter from './routes/adminAcademics';
import studentPortalRouter from './routes/studentPortal';
import auditRouter from './routes/audit';
import searchRouter from './routes/search';
import notificationsRouter from './routes/notifications';
import emailNotificationsRouter from './routes/notifications/email';
import supportRouter from './routes/support';
import metricsRouter from './routes/metrics';
import incidentResponseRouter from './routes/incident-response';
import { errorHandler } from './middleware/errorHandler';
import { metricsMiddleware } from './middleware/metrics';
import { initializeErrorTracking } from './services/monitoring/errorTracking';
import { requestLogger } from './services/monitoring/loggingService';
import authenticate from './middleware/authenticate';
import { tenantResolver } from './middleware/tenantResolver';
import { apiLimiter, writeLimiter, adminActionLimiter, superuserStrictLimiter } from './middleware/rateLimiter';
import { sanitizeInput } from './middleware/validateInput';
import { setCsrfToken, csrfProtection } from './middleware/csrf';
import { auditAdminActions } from './middleware/auditAdminActions';
import { enhancedTenantIsolation } from './middleware/enhancedTenantIsolation';
import { parsePagination } from './middleware/pagination';
import { cachePolicies } from './middleware/cache';

// Initialize error tracking
initializeErrorTracking();

const app = express();

const defaultDevOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175'
];

const configuredOrigins =
  process.env.CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : defaultDevOrigins;

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }
  if (allowedOrigins.includes(origin)) {
    return true;
  }
  try {
    const { protocol, hostname, port } = new URL(origin);
    const isHttp = protocol === 'http:' || protocol === 'https:';
    const isLocalHost =
      hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
    const devPorts = new Set(['3000', '3001', '4173', '5172', '5173', '5174', '5175']);
    if (isHttp && isLocalHost && (!port || devPorts.has(port))) {
      return true;
    }
  } catch {
    // ignore malformed origins
  }
  return false;
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin ?? 'unknown'} not permitted by CORS policy`));
    },
    credentials: true
  })
);

app.use(cookieParser()); // Parse cookies for CSRF tokens
app.use(express.json({ limit: '10mb' })); // Limit request body size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global middleware
app.use(requestLogger); // Request logging
app.use(metricsMiddleware); // Prometheus metrics
app.use(apiLimiter); // Apply rate limiting to all routes
app.use(sanitizeInput); // Sanitize all input
app.use(setCsrfToken); // Set CSRF token cookie

// Health check (no auth required)
app.use('/health', healthRouter);
// Metrics endpoint (no auth required, but should be protected in production)
app.use('/metrics', metricsRouter);
// Public schools endpoint (no auth required)
import schoolsPublicRouter from './routes/schools';
app.use('/schools', schoolsPublicRouter);
// Auth routes (with strict rate limiting)
app.use('/auth', authRouter);

// Protected routes with enhanced security
app.use('/tenants', authenticate, tenantResolver({ optional: true }), enhancedTenantIsolation, csrfProtection, auditAdminActions, tenantsRouter);
app.use('/students', authenticate, tenantResolver(), enhancedTenantIsolation, writeLimiter, csrfProtection, parsePagination, cachePolicies.user, studentsRouter);
app.use('/teachers', authenticate, tenantResolver(), enhancedTenantIsolation, writeLimiter, csrfProtection, parsePagination, cachePolicies.user, teachersRouter);
app.use('/branding', authenticate, tenantResolver(), enhancedTenantIsolation, writeLimiter, csrfProtection, brandingRouter);
app.use('/school', authenticate, tenantResolver(), enhancedTenantIsolation, writeLimiter, csrfProtection, schoolRouter);
app.use('/attendance', authenticate, tenantResolver(), enhancedTenantIsolation, writeLimiter, csrfProtection, parsePagination, cachePolicies.user, attendanceRouter);
app.use('/exams', authenticate, tenantResolver(), enhancedTenantIsolation, writeLimiter, csrfProtection, parsePagination, cachePolicies.user, examsRouter);
app.use('/grades', authenticate, tenantResolver(), enhancedTenantIsolation, writeLimiter, csrfProtection, parsePagination, cachePolicies.sensitive, gradesRouter);
app.use('/results', authenticate, tenantResolver(), enhancedTenantIsolation, parsePagination, cachePolicies.user, resultsRouter);
app.use('/invoices', authenticate, tenantResolver(), enhancedTenantIsolation, writeLimiter, csrfProtection, parsePagination, cachePolicies.sensitive, invoicesRouter);
app.use('/payments', authenticate, tenantResolver(), enhancedTenantIsolation, writeLimiter, csrfProtection, parsePagination, cachePolicies.sensitive, paymentsRouter);
app.use('/configuration', authenticate, tenantResolver(), enhancedTenantIsolation, writeLimiter, csrfProtection, configurationRouter);
app.use('/reports', authenticate, tenantResolver(), enhancedTenantIsolation, parsePagination, cachePolicies.admin, reportsRouter);
// Superuser routes with stricter rate limiting for sensitive operations
app.use('/superuser', authenticate, tenantResolver({ optional: true }), superuserStrictLimiter, csrfProtection, auditAdminActions, cachePolicies.sensitive, superuserRouter);
app.use('/users', authenticate, tenantResolver({ optional: true }), enhancedTenantIsolation, writeLimiter, csrfProtection, parsePagination, cachePolicies.admin, usersRouter);
app.use('/teacher', authenticate, tenantResolver(), enhancedTenantIsolation, parsePagination, cachePolicies.user, teacherRouter);
app.use('/student', authenticate, tenantResolver(), enhancedTenantIsolation, parsePagination, cachePolicies.user, studentPortalRouter);
app.use('/audit', authenticate, tenantResolver({ optional: true }), parsePagination, cachePolicies.sensitive, auditRouter);
app.use('/search', authenticate, tenantResolver(), enhancedTenantIsolation, parsePagination, cachePolicies.user, searchRouter);
app.use('/notifications', authenticate, tenantResolver(), enhancedTenantIsolation, parsePagination, cachePolicies.user, notificationsRouter);
app.use('/api/notifications/email', emailNotificationsRouter);
app.use('/api/support', supportRouter);
app.use('/incident-response', incidentResponseRouter);

// Admin overview routes
import adminOverviewRouter from './routes/admin/overview';
app.use('/admin/overview', authenticate, tenantResolver(), enhancedTenantIsolation, cachePolicies.admin, adminOverviewRouter);

app.use('/admin', authenticate, tenantResolver(), enhancedTenantIsolation, adminActionLimiter, csrfProtection, auditAdminActions, parsePagination, cachePolicies.admin, adminAcademicsRouter);
// Admin users routes (HOD management)
import adminUsersRouter from './routes/admin/users';
app.use('/admin/users', authenticate, tenantResolver(), enhancedTenantIsolation, adminActionLimiter, csrfProtection, auditAdminActions, cachePolicies.admin, adminUsersRouter);
// Admin departments routes
import adminDepartmentsRouter from './routes/admin/departments';
app.use('/admin/departments', authenticate, tenantResolver(), enhancedTenantIsolation, adminActionLimiter, csrfProtection, auditAdminActions, cachePolicies.admin, adminDepartmentsRouter);
// Admin classes routes
import adminClassesRouter from './routes/admin/classes';
app.use('/admin/classes', authenticate, tenantResolver(), enhancedTenantIsolation, adminActionLimiter, csrfProtection, auditAdminActions, cachePolicies.admin, adminClassesRouter);
// Admin user management routes
import adminUserManagementRouter from './routes/admin/userManagement';
app.use('/admin/users', authenticate, tenantResolver(), enhancedTenantIsolation, adminActionLimiter, csrfProtection, auditAdminActions, cachePolicies.admin, adminUserManagementRouter);
// Admin dashboard routes
import adminDashboardRouter from './routes/admin/dashboard';
app.use('/admin/dashboard', authenticate, tenantResolver(), enhancedTenantIsolation, adminActionLimiter, csrfProtection, auditAdminActions, cachePolicies.admin, adminDashboardRouter);
// Admin reports routes
import adminReportsRouter from './routes/admin/reports';
app.use('/admin/reports', authenticate, tenantResolver(), enhancedTenantIsolation, adminActionLimiter, csrfProtection, auditAdminActions, cachePolicies.admin, adminReportsRouter);
// Admin notifications routes
import adminNotificationsRouter from './routes/admin/notifications';
app.use('/admin', authenticate, tenantResolver(), enhancedTenantIsolation, adminActionLimiter, csrfProtection, auditAdminActions, cachePolicies.admin, adminNotificationsRouter);
// Admin billing routes
import adminBillingRouter from './routes/admin/billing';
app.use('/admin/billing', authenticate, tenantResolver(), enhancedTenantIsolation, adminActionLimiter, csrfProtection, auditAdminActions, cachePolicies.admin, adminBillingRouter);

// File upload routes
import uploadRouter from './routes/upload';
app.use('/upload', uploadRouter);

// Export routes
import exportRouter from './routes/export';
app.use('/reports/export', exportRouter);


// Serve uploaded files statically
import path from 'path';
const uploadsDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsDir));

app.use(errorHandler);

export default app;
