import express from 'express';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import tenantsRouter from './routes/tenants';
import studentsRouter from './routes/students';
import teachersRouter from './routes/teachers';
import brandingRouter from './routes/branding';
import schoolRouter from './routes/school';
import { errorHandler } from './middleware/errorHandler';
import authenticate from './middleware/authenticate';
import { requirePermission } from './middleware/rbac';
import { tenantResolver } from './middleware/tenantResolver';

const app = express();

app.use(express.json());

app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/tenants', tenantsRouter);
app.use('/students', studentsRouter);
app.use('/teachers', teachersRouter);
app.use('/branding', brandingRouter);
app.use('/school', schoolRouter);

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

app.use(errorHandler);

export default app;

