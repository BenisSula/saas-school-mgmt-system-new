import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import tenantResolver from '../../middleware/tenantResolver';
import { requirePermission } from '../../middleware/rbac';
import { getPool } from '../../db/connection';
import {
  createIncident,
  getIncidents,
  getIncidentWithUpdates,
  addIncidentUpdate,
  createScheduledMaintenance,
  getScheduledMaintenance,
  updateMaintenanceStatus,
  recordUptimeCheck,
  getUptimeStatistics,
  getStatusPageSummary,
} from '../../services/support/statusPageService';
import { z } from 'zod';

const router = Router();

// Public status page (no auth required)
router.get('/public', async (req, res, next) => {
  try {
    const tenantId = req.query.tenantId as string | undefined;
    const pool = getPool();
    const client = await pool.connect();
    try {
      const summary = await getStatusPageSummary(client, tenantId);
      res.json(summary);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.use(authenticate, tenantResolver({ optional: true }));

const createIncidentSchema = z.object({
  tenantId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  status: z.enum(['investigating', 'identified', 'monitoring', 'resolved']),
  severity: z.enum(['minor', 'major', 'critical']),
  affectedServices: z.array(z.string()).optional(),
});

const createIncidentUpdateSchema = z.object({
  status: z.enum(['investigating', 'identified', 'monitoring', 'resolved']),
  message: z.string().min(1),
});

const createMaintenanceSchema = z.object({
  tenantId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  affectedServices: z.array(z.string()).optional(),
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime(),
});

// Get incidents
router.get('/incidents', requirePermission('status:view'), async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await getIncidents(client, {
        tenantId: req.tenant?.id,
        status: req.query.status as string,
        severity: req.query.severity as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      });
      res.json(result);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Get incident with updates
router.get('/incidents/:id', requirePermission('status:view'), async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const incident = await getIncidentWithUpdates(client, req.params.id);
      if (!incident) {
        return res.status(404).json({ message: 'Incident not found' });
      }
      res.json(incident);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Create incident
router.post('/incidents', requirePermission('status:manage'), async (req, res, next) => {
  try {
    const parsed = createIncidentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const incident = await createIncident(client, {
        ...parsed.data,
        tenantId: req.tenant?.id,
        createdBy: req.user?.id,
      });
      res.status(201).json(incident);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Add incident update
router.post(
  '/incidents/:id/updates',
  requirePermission('status:manage'),
  async (req, res, next) => {
    try {
      const parsed = createIncidentUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.message });
      }

      const pool = getPool();
      const client = await pool.connect();
      try {
        const update = await addIncidentUpdate(client, {
          incidentId: req.params.id,
          ...parsed.data,
          createdBy: req.user?.id,
        });
        res.status(201).json(update);
      } finally {
        client.release();
      }
    } catch (error) {
      next(error);
    }
  }
);

// Get scheduled maintenance
router.get('/maintenance', requirePermission('status:view'), async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await getScheduledMaintenance(client, {
        tenantId: req.tenant?.id,
        status: req.query.status as string,
        upcomingOnly: req.query.upcomingOnly === 'true',
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      });
      res.json(result);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Create scheduled maintenance
router.post('/maintenance', requirePermission('status:manage'), async (req, res, next) => {
  try {
    const parsed = createMaintenanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const maintenance = await createScheduledMaintenance(client, {
        ...parsed.data,
        tenantId: req.tenant?.id,
        scheduledStart: new Date(parsed.data.scheduledStart),
        scheduledEnd: new Date(parsed.data.scheduledEnd),
        createdBy: req.user?.id,
      });
      res.status(201).json(maintenance);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Update maintenance status
router.patch('/maintenance/:id', requirePermission('status:manage'), async (req, res, next) => {
  try {
    const schema = z.object({
      status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']),
      actualStart: z.string().datetime().optional(),
      actualEnd: z.string().datetime().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const maintenance = await updateMaintenanceStatus(
        client,
        req.params.id,
        parsed.data.status,
        parsed.data.actualStart ? new Date(parsed.data.actualStart) : undefined,
        parsed.data.actualEnd ? new Date(parsed.data.actualEnd) : undefined
      );
      res.json(maintenance);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Record uptime check (typically called by monitoring service)
router.post('/uptime', requirePermission('status:manage'), async (req, res, next) => {
  try {
    const schema = z.object({
      tenantId: z.string().uuid().optional(),
      serviceName: z.string(),
      status: z.enum(['up', 'down', 'degraded']),
      responseTimeMs: z.number().int().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      await recordUptimeCheck(client, {
        ...parsed.data,
        tenantId: req.tenant?.id,
      });
      res.json({ success: true });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Get uptime statistics
router.get('/uptime', requirePermission('status:view'), async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const stats = await getUptimeStatistics(client, {
        tenantId: req.tenant?.id,
        serviceName: req.query.serviceName as string,
        days: req.query.days ? parseInt(req.query.days as string, 10) : undefined,
      });
      res.json({ statistics: stats });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

export default router;
