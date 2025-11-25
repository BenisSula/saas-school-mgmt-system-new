import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import ensureTenantContext from '../middleware/ensureTenantContext';
import { listAuditLogs, type AuditEntityType } from '../services/auditLogService';

const router = Router();

router.use(authenticate, tenantResolver(), ensureTenantContext());

// Get audit logs for current user or with permission
router.get('/logs', async (req, res, next) => {
  try {
    const userId = req.query.userId as string | undefined;
    const entityType = req.query.entityType as string | undefined;
    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to = req.query.to ? new Date(req.query.to as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;

    // Users can only view their own audit logs unless they have permission
    const targetUserId = userId || req.user?.id;
    const canViewAll = req.user?.role === 'admin' || req.user?.role === 'superadmin';

    if (!canViewAll && targetUserId !== req.user?.id) {
      return res.status(403).json({ message: 'You can only view your own audit logs' });
    }

    const logs = await listAuditLogs(req.tenantClient!, req.tenant!.schema, {
      userId: targetUserId,
      entityType: entityType as AuditEntityType | undefined,
      from,
      to,
      limit,
    });

    // Transform to match frontend AuditLogEntry interface
    const transformedLogs = logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entity_type,
      entityId: log.entity_id,
      userId: log.user_id,
      userEmail: null, // Will need to join with users table if needed
      timestamp: log.created_at,
      details: log.details,
      ipAddress: null, // Not stored in audit_logs table currently
    }));

    res.json(transformedLogs);
  } catch (error) {
    next(error);
  }
});

// Get activity history (simplified audit logs for user activity)
router.get('/activity', async (req, res, next) => {
  try {
    const userId = req.query.userId as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const targetUserId = userId || req.user?.id;
    const canViewAll = req.user?.role === 'admin' || req.user?.role === 'superadmin';

    if (!canViewAll && targetUserId !== req.user?.id) {
      return res.status(403).json({ message: 'You can only view your own activity' });
    }

    const logs = await listAuditLogs(req.tenantClient!, req.tenant!.schema, {
      userId: targetUserId,
      limit,
    });

    // Transform to activity history format
    const activities = logs.map((log) => ({
      id: log.id,
      action: log.action,
      description: `${log.action} on ${log.entityType}`,
      timestamp: log.created_at,
      metadata: log.details || {},
    }));

    res.json(activities);
  } catch (error) {
    next(error);
  }
});

export default router;
