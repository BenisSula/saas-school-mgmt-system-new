import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import tenantResolver from '../../middleware/tenantResolver';
import { requirePermission } from '../../middleware/rbac';
import { getPool } from '../../db/connection';
import {
  createTicket,
  getTicket,
  getTickets,
  updateTicket,
  addTicketComment,
  getTicketComments,
  getTicketWithComments,
} from '../../services/support/ticketingService';
import { z } from 'zod';

const router = Router();

router.use(authenticate, tenantResolver({ optional: true }));

const createTicketSchema = z.object({
  tenantId: z.string().uuid().optional(),
  subject: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  category: z.enum(['technical', 'billing', 'feature_request', 'bug', 'other']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateTicketSchema = z.object({
  subject: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed', 'pending']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  category: z.enum(['technical', 'billing', 'feature_request', 'bug', 'other']).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
});

const createCommentSchema = z.object({
  content: z.string().min(1),
  isInternal: z.boolean().optional(),
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
});

// Create ticket
router.post('/', requirePermission('support:raise'), async (req, res, next) => {
  try {
    const parsed = createTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    const pool = getPool();
    const client = await pool.connect();
    try {
      const ticket = await createTicket(client, {
        ...parsed.data,
        tenantId: req.tenant?.id,
        createdBy: req.user?.id || '',
      });
      res.status(201).json(ticket);

      return;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

// Get tickets
router.get('/', requirePermission('support:view'), async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await getTickets(client, {
        tenantId: req.tenant?.id,
        status: req.query.status as string,
        priority: req.query.priority as string,
        category: req.query.category as string,
        createdBy: req.query.createdBy as string,
        assignedTo: req.query.assignedTo as string,
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

// Get ticket by ID
router.get('/:id', requirePermission('support:view'), async (req, res, next) => {
  try {
    const includeComments = req.query.comments === 'true';
    const includeInternal = req.user?.role === 'superadmin' || req.user?.role === 'admin';

    const pool = getPool();
    const client = await pool.connect();
    try {
      if (includeComments) {
        const ticket = await getTicketWithComments(
          client,
          req.params.id,
          includeInternal,
          req.tenant?.id
        );
        if (!ticket) {
          return res.status(404).json({ message: 'Ticket not found' });
        }
        res.json(ticket);
        return;
      } else {
        const ticket = await getTicket(client, req.params.id, req.tenant?.id);
        if (!ticket) {
          return res.status(404).json({ message: 'Ticket not found' });
        }
        res.json(ticket);
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

// Update ticket
router.patch('/:id', requirePermission('support:manage'), async (req, res, next) => {
  try {
    const parsed = updateTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    const pool = getPool();
    const client = await pool.connect();
    try {
      const ticket = await updateTicket(client, req.params.id, parsed.data, req.user?.id);
      res.json(ticket);

      return;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

// Add comment to ticket
router.post('/:id/comments', requirePermission('support:view'), async (req, res, next) => {
  try {
    const parsed = createCommentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    const pool = getPool();
    const client = await pool.connect();
    try {
      const comment = await addTicketComment(client, {
        ticketId: req.params.id,
        userId: req.user?.id || '',
        ...parsed.data,
      });
      res.status(201).json(comment);

      return;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

// Get ticket comments
router.get('/:id/comments', requirePermission('support:view'), async (req, res, next) => {
  try {
    const includeInternal = req.user?.role === 'superadmin' || req.user?.role === 'admin';

    const pool = getPool();
    const client = await pool.connect();
    try {
      const comments = await getTicketComments(
        client,
        req.params.id,
        includeInternal,
        req.user?.id
      );
      res.json({ comments });

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
