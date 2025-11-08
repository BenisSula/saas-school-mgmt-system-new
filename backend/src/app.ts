import express from 'express';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import tenantsRouter from './routes/tenants';
import authenticate from './middleware/authenticate';
import { requirePermission } from './middleware/rbac';
import { tenantResolver } from './middleware/tenantResolver';

const app = express();

app.use(express.json());

app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/tenants', tenantsRouter);

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

export default app;

