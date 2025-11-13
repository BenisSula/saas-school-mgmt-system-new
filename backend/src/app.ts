import express from 'express';
import cors from 'cors';
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
import { errorHandler } from './middleware/errorHandler';
import authenticate from './middleware/authenticate';
import { requirePermission } from './middleware/rbac';
import { tenantResolver } from './middleware/tenantResolver';

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

app.use(express.json());

app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/tenants', tenantsRouter);
app.use('/students', studentsRouter);
app.use('/teachers', teachersRouter);
app.use('/branding', brandingRouter);
app.use('/school', schoolRouter);
app.use('/attendance', attendanceRouter);
app.use('/exams', examsRouter);
app.use('/grades', gradesRouter);
app.use('/results', resultsRouter);
app.use('/invoices', invoicesRouter);
app.use('/payments', paymentsRouter);
app.use('/configuration', configurationRouter);
app.use('/reports', reportsRouter);
app.use('/superuser', superuserRouter);
app.use('/users', usersRouter);
app.use('/teacher', teacherRouter);
app.use('/student', studentPortalRouter);

app.get(
  '/admin/overview',
  authenticate,
  tenantResolver({ optional: true }),
  requirePermission('users:manage'),
  (req, res) => {
    res.status(200).json({
      message: 'Welcome, admin',
      tenant: req.tenant ?? null
    });
  }
);

app.use('/admin', adminAcademicsRouter);

app.use(errorHandler);

export default app;
