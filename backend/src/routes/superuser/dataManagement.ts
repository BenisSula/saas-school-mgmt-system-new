import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import tenantResolver from '../../middleware/tenantResolver';
import { requirePermission } from '../../middleware/rbac';
import { getPool } from '../../db/connection';
import {
  createBackup,
  getBackupJobs,
  createBackupSchedule,
  getBackupSchedules,
  updateBackupSchedule,
  deleteBackupSchedule,
} from '../../services/dataManagement/backupService';
import {
  createExportJob,
  getExportJobs,
  createImportJob,
  getImportJobs,
} from '../../services/dataManagement/exportImportService';
import {
  createGdprErasureRequest,
  verifyGdprErasureRequest,
  processGdprErasure,
  getGdprErasureRequests,
  cancelGdprErasureRequest,
} from '../../services/dataManagement/gdprService';
import { z } from 'zod';

const router = Router();

router.use(authenticate, tenantResolver({ optional: true }), requirePermission('tenants:manage'));

const createBackupSchema = z.object({
  tenantId: z.string().uuid().optional(),
  backupType: z.enum(['full', 'incremental', 'schema_only', 'data_only']),
  storageProvider: z.enum(['local', 's3', 'azure', 'gcs']),
  storageLocation: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const createBackupScheduleSchema = z.object({
  tenantId: z.string().uuid().optional(),
  name: z.string().min(1),
  backupType: z.enum(['full', 'incremental', 'schema_only', 'data_only']),
  scheduleCron: z.string(),
  retentionDays: z.number().int().positive().optional(),
  storageProvider: z.enum(['local', 's3', 'azure', 'gcs']),
  storageConfig: z.record(z.string(), z.unknown()).optional(),
});

const createExportSchema = z.object({
  tenantId: z.string().uuid(),
  exportType: z.enum(['full', 'partial', 'gdpr', 'custom']),
  format: z.enum(['json', 'csv', 'sql', 'excel']),
  tablesIncluded: z.array(z.string()).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
});

const createImportSchema = z.object({
  tenantId: z.string().uuid(),
  importType: z.enum(['full', 'merge', 'update_only']),
  format: z.enum(['json', 'csv', 'sql', 'excel']),
  fileUrl: z.string().url(),
  fileSizeBytes: z.number().int().optional(),
  tablesTargeted: z.array(z.string()).optional(),
});

const createGdprRequestSchema = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  requestType: z.enum(['full_erasure', 'anonymize', 'export_only']),
  reason: z.string().optional(),
  dataCategories: z.array(z.string()).optional(),
});

// Backup Jobs
router.post('/backups', async (req, res, next) => {
  try {
    const parsed = createBackupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const backup = await createBackup(client, {
        ...parsed.data,
        tenantId: req.tenant?.id,
        createdBy: req.user?.id,
      });
      res.status(201).json(backup);

      return;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

router.get('/backups', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await getBackupJobs(client, {
        tenantId: req.tenant?.id,
        status: req.query.status as string,
        backupType: req.query.backupType as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      });
      res.json(result);

      return;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

// Backup Schedules
router.post('/backup-schedules', async (req, res, next) => {
  try {
    const parsed = createBackupScheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const schedule = await createBackupSchedule(client, {
        ...parsed.data,
        tenantId: req.tenant?.id,
        createdBy: req.user?.id,
      });
      res.status(201).json(schedule);

      return;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

router.get('/backup-schedules', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const schedules = await getBackupSchedules(client, req.tenant?.id);
      res.json({ schedules });

      return;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

router.patch('/backup-schedules/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const schedule = await updateBackupSchedule(client, req.params.id, req.body);
      res.json(schedule);

      return;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

router.delete('/backup-schedules/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await deleteBackupSchedule(client, req.params.id, req.tenant?.id);
      res.status(204).send();
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

// Data Export
router.post('/exports', async (req, res, next) => {
  try {
    const parsed = createExportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const job = await createExportJob(client, {
        ...parsed.data,
        requestedBy: req.user?.id,
      });
      res.status(201).json(job);

      return;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

router.get('/exports', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await getExportJobs(client, {
        tenantId: req.tenant?.id,
        status: req.query.status as string,
        exportType: req.query.exportType as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      });
      res.json(result);

      return;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

// Data Import
router.post('/imports', async (req, res, next) => {
  try {
    const parsed = createImportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const job = await createImportJob(client, {
        ...parsed.data,
        requestedBy: req.user?.id,
      });
      res.status(201).json(job);

      return;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

router.get('/imports', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await getImportJobs(client, {
        tenantId: req.tenant?.id,
        status: req.query.status as string,
        importType: req.query.importType as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      });
      res.json(result);

      return;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

// GDPR Erasure
router.post('/gdpr/requests', async (req, res, next) => {
  try {
    const parsed = createGdprRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const request = await createGdprErasureRequest(client, {
        ...parsed.data,
        requestedBy: req.user?.id,
      });
      res.status(201).json(request);

      return;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

router.post('/gdpr/requests/:id/verify', async (req, res, next) => {
  try {
    const { verificationToken } = req.body;
    if (!verificationToken) {
      return res.status(400).json({ message: 'Verification token required' });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const verified = await verifyGdprErasureRequest(client, req.params.id, verificationToken);
      if (verified) {
        res.json({ success: true });
        return;
      } else {
        res.status(400).json({ message: 'Invalid verification token' });
        return;
      }
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

router.post(
  '/gdpr/requests/:id/process',
  requirePermission('tenants:manage'),
  async (req, res, next) => {
    try {
      const pool = getPool();
      const client = await pool.connect();
      try {
        const result = await processGdprErasure(client, req.params.id, req.user?.id || '');
        res.json(result);

        return;
      } finally {
        client.release();
      }
    } catch (error) {
      next(error);

      return;
    }
  }
);

router.get('/gdpr/requests', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await getGdprErasureRequests(client, {
        tenantId: req.tenant?.id,
        userId: req.query.userId as string,
        status: req.query.status as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      });
      res.json(result);

      return;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

router.post('/gdpr/requests/:id/cancel', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await cancelGdprErasureRequest(client, req.params.id);
      res.json({ success: true });

      return;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

export default router;
