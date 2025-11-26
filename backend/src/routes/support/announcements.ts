import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import tenantResolver from '../../middleware/tenantResolver';
import { requirePermission } from '../../middleware/rbac';
import { getPool } from '../../db/connection';
import {
  createAnnouncement,
  getAnnouncementsForUser,
  markAnnouncementAsViewed,
  getAllAnnouncements,
  updateAnnouncement,
  deleteAnnouncement,
} from '../../services/support/announcementsService';
import { z } from 'zod';

const router = Router();

router.use(authenticate, tenantResolver({ optional: true }));

const createAnnouncementSchema = z.object({
  tenantId: z.string().uuid().optional(),
  title: z.string().min(1),
  content: z.string().min(1),
  contentHtml: z.string().optional(),
  type: z.enum(['info', 'warning', 'success', 'error', 'maintenance']),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  isPinned: z.boolean().optional(),
  targetRoles: z.array(z.string()).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const updateAnnouncementSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  contentHtml: z.string().optional(),
  type: z.enum(['info', 'warning', 'success', 'error', 'maintenance']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  isPinned: z.boolean().optional(),
  isActive: z.boolean().optional(),
  targetRoles: z.array(z.string()).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Get announcements for current user
router.get('/me', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const announcements = await getAnnouncementsForUser(
        client,
        req.user?.id || '',
        req.tenant?.id,
        req.user?.role
      );
      res.json({ announcements });

      return;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

// Mark announcement as viewed
router.post('/:id/view', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await markAnnouncementAsViewed(client, req.params.id, req.user?.id || '');
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

// Get all announcements (admin)
router.get('/', requirePermission('announcements:manage'), async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await getAllAnnouncements(client, req.tenant?.id, {
        type: req.query.type as string,
        isActive:
          req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
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

// Create announcement
router.post('/', requirePermission('announcements:manage'), async (req, res, next) => {
  try {
    const parsed = createAnnouncementSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const announcement = await createAnnouncement(client, {
        ...parsed.data,
        tenantId: req.tenant?.id,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
        createdBy: req.user?.id,
      });
      res.status(201).json(announcement);

      return;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

// Update announcement
router.patch('/:id', requirePermission('announcements:manage'), async (req, res, next) => {
  try {
    const parsed = updateAnnouncementSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const announcement = await updateAnnouncement(client, req.params.id, {
        ...parsed.data,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
      });
      res.json(announcement);

      return;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

// Delete announcement
router.delete('/:id', requirePermission('announcements:manage'), async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await deleteAnnouncement(client, req.params.id, req.tenant?.id);
      res.status(204).send();
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);

    return;
  }
});

export default router;
