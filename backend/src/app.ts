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
import { errorHandler } from './middleware/errorHandler';
import authenticate from './middleware/authenticate';
import { requirePermission } from './middleware/rbac';
import { tenantResolver } from './middleware/tenantResolver';
import { apiLimiter, writeLimiter, adminActionLimiter } from './middleware/rateLimiter';
import { sanitizeInput } from './middleware/validateInput';
import { setCsrfToken, csrfProtection } from './middleware/csrf';
import { auditAdminActions } from './middleware/auditAdminActions';
import { enhancedTenantIsolation } from './middleware/enhancedTenantIsolation';
import { parsePagination } from './middleware/pagination';
import { cachePolicies } from './middleware/cache';

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
app.use(apiLimiter); // Apply rate limiting to all routes
app.use(sanitizeInput); // Sanitize all input
app.use(setCsrfToken); // Set CSRF token cookie

// Health check (no auth required)
app.use('/health', healthRouter);
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
app.use('/superuser', authenticate, tenantResolver({ optional: true }), adminActionLimiter, csrfProtection, auditAdminActions, cachePolicies.sensitive, superuserRouter);
app.use('/users', authenticate, tenantResolver({ optional: true }), enhancedTenantIsolation, writeLimiter, csrfProtection, parsePagination, cachePolicies.admin, usersRouter);
app.use('/teacher', authenticate, tenantResolver(), enhancedTenantIsolation, parsePagination, cachePolicies.user, teacherRouter);
app.use('/student', authenticate, tenantResolver(), enhancedTenantIsolation, parsePagination, cachePolicies.user, studentPortalRouter);
app.use('/audit', authenticate, tenantResolver({ optional: true }), parsePagination, cachePolicies.sensitive, auditRouter);
app.use('/search', authenticate, tenantResolver(), enhancedTenantIsolation, parsePagination, cachePolicies.user, searchRouter);
app.use('/notifications', authenticate, tenantResolver(), enhancedTenantIsolation, parsePagination, cachePolicies.user, notificationsRouter);

app.get(
  '/admin/overview',
  authenticate,
  tenantResolver({ optional: true }),
  enhancedTenantIsolation,
  requirePermission('users:manage'),
  cachePolicies.admin,
  (req, res) => {
    res.status(200).json({
      message: 'Welcome, admin',
      tenant: req.tenant ?? null
    });
  }
);

app.use('/admin', authenticate, tenantResolver(), enhancedTenantIsolation, adminActionLimiter, csrfProtection, auditAdminActions, parsePagination, cachePolicies.admin, adminAcademicsRouter);

app.use(errorHandler);

export default app;
