import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/rbac';
import { getPool } from '../../db/connection';
import {
  queueEmail,
  processEmailQueue,
  upsertEmailTemplate,
  getEmailTemplate,
} from '../../services/email/emailService';
import { z } from 'zod';

const router = Router();

// Email sending endpoints (require authentication)
router.use(authenticate);

const sendEmailSchema = z.object({
  tenantId: z.string().uuid().optional(),
  templateKey: z.string(),
  recipientEmail: z.string().email(),
  recipientName: z.string().optional(),
  variables: z.record(z.string(), z.unknown()).optional(),
  priority: z.number().int().min(1).max(10).optional(),
  scheduledAt: z.string().datetime().optional(),
});

// Queue email for sending
router.post('/send', requirePermission('notifications:send'), async (req, res, next) => {
  try {
    const parsed = sendEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await queueEmail(client, {
        ...parsed.data,
        scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
      });
      res.json(result);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
    return;
  }
});

// Process email queue (admin only, typically called by cron)
router.post('/process-queue', requirePermission('tenants:manage'), async (req, res, next) => {
  try {
    const batchSize = req.body.batchSize || 10;
    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await processEmailQueue(client, batchSize);
      res.json(result);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
    return;
  }
});

// Get email template
router.get('/templates/:templateKey', async (req, res, next) => {
  try {
    const tenantId = req.query.tenantId as string | undefined;
    const pool = getPool();
    const client = await pool.connect();
    try {
      const template = await getEmailTemplate(client, req.params.templateKey, tenantId);
      if (!template) {
        return res.status(404).json({ message: 'Email template not found' });
      }
      res.json(template);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
    return;
  }
});

// Create or update email template
router.post('/templates', requirePermission('tenants:manage'), async (req, res, next) => {
  try {
    const schema = z.object({
      templateKey: z.string(),
      templateName: z.string(),
      subject: z.string(),
      bodyHtml: z.string(),
      bodyText: z.string().optional(),
      variables: z.record(z.string(), z.unknown()).optional(),
      tenantId: z.string().uuid().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const template = await upsertEmailTemplate(client, parsed.data);
      res.json(template);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
    return;
  }
});

export default router;
