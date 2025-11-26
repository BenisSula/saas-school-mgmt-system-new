import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import tenantResolver from '../../middleware/tenantResolver';
import { requirePermission } from '../../middleware/rbac';
import { getPool } from '../../db/connection';
import {
  createMessage,
  getUserMessages,
  markMessageAsRead,
  archiveMessage,
  getMessageThread,
} from '../../services/support/messagingService';
import { z } from 'zod';

const router = Router();

router.use(authenticate, tenantResolver({ optional: true }));

const createMessageSchema = z.object({
  tenantId: z.string().uuid().optional(),
  recipientId: z.string().uuid().optional(),
  recipientRole: z.string().optional(),
  subject: z.string().min(1),
  content: z.string().min(1),
  contentHtml: z.string().optional(),
  messageType: z.enum(['direct', 'broadcast', 'system']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  attachments: z
    .array(
      z.object({
        fileName: z.string(),
        fileUrl: z.string(),
        fileSize: z.number(),
        mimeType: z.string(),
      })
    )
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Get user messages
router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await getUserMessages(client, req.user?.id || '', req.tenant?.id, {
        isRead:
          req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined,
        isArchived:
          req.query.isArchived === 'true'
            ? true
            : req.query.isArchived === 'false'
              ? false
              : undefined,
        messageType: req.query.messageType as string,
        priority: req.query.priority as string,
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

// Create message
router.post('/', requirePermission('messages:send'), async (req, res, next) => {
  try {
    const parsed = createMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const message = await createMessage(client, {
        ...parsed.data,
        tenantId: req.tenant?.id,
        senderId: req.user?.id || '',
      });
      res.status(201).json(message);

      return;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

// Mark message as read
router.post('/:id/read', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await markMessageAsRead(client, req.params.id, req.user?.id || '');
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

// Archive message
router.post('/:id/archive', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await archiveMessage(client, req.params.id, req.user?.id || '');
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

// Get message thread
router.get('/threads/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const thread = await getMessageThread(client, req.params.id, req.user?.id || '');
      if (!thread) {
        return res.status(404).json({ message: 'Thread not found' });
      }
      res.json(thread);

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
