/**
 * Notifications Routes
 * User notification management
 */

import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../services/notificationService';
import { z } from 'zod';

const router = Router();

const limitSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

router.use(authenticate, tenantResolver());

router.get('/', async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant || !req.user) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }

    const parsed = limitSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const notifications = await getUserNotifications(
      req.tenantClient,
      req.tenant.schema,
      req.user.id,
      parsed.data.limit
    );

    res.json({ notifications });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/read', async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant || !req.user) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }

    const success = await markNotificationAsRead(
      req.tenantClient,
      req.tenant.schema,
      req.params.id,
      req.user.id
    );

    if (!success) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post('/read-all', async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant || !req.user) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }

    const count = await markAllNotificationsAsRead(
      req.tenantClient,
      req.tenant.schema,
      req.user.id
    );
    res.json({ marked: count });
  } catch (error) {
    next(error);
  }
});

export default router;
