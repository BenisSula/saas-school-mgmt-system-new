/**
 * Admin Notification Routes
 * Handles announcements and notifications within tenant
 */

import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import tenantResolver from '../../middleware/tenantResolver';
import ensureTenantContext from '../../middleware/ensureTenantContext';
import { requirePermission } from '../../middleware/rbac';
import { validateInput } from '../../middleware/validateInput';
import { z } from 'zod';
import { getPool } from '../../db/connection';
import { createSuccessResponse, createErrorResponse } from '../../lib/responseHelpers';
import { createAuditLog } from '../../services/audit/enhancedAuditService';
import {
  verifyTenantAndUserContext,
  verifyTenantContext,
} from '../../services/shared/adminHelpers';

const router = Router();

router.use(
  authenticate,
  tenantResolver(),
  ensureTenantContext(),
  requirePermission('users:manage')
);

const announcementSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  targetRoles: z
    .array(z.enum(['admin', 'hod', 'teacher', 'student']))
    .min(1, 'At least one target role is required'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
  expiresAt: z.string().datetime().optional().nullable(),
});

/**
 * POST /admin/announcements
 * Create a new announcement
 */
router.post('/announcements', validateInput(announcementSchema, 'body'), async (req, res, next) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const contextCheck = verifyTenantAndUserContext(req.tenant, req.tenantClient, req.user);
    if (!contextCheck.isValid) {
      return res.status(500).json(createErrorResponse(contextCheck.error!));
    }

    // TypeScript: After validation, we know these are defined
    const tenant = req.tenant!;
    const tenantClient = req.tenantClient!;
    const user = req.user!;

    // Check if announcements table exists in tenant schema
    // If not, use shared.notifications table
    const schema = tenant.schema;
    let announcementId: string;

    try {
      // Try tenant schema first
      const result = await tenantClient.query<{ id: string }>(
        `INSERT INTO ${schema}.announcements 
         (title, content, target_roles, priority, created_by, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          req.body.title,
          req.body.content,
          req.body.targetRoles,
          req.body.priority,
          user.id,
          req.body.expiresAt ? new Date(req.body.expiresAt) : null,
        ]
      );
      announcementId = result.rows[0].id;
    } catch {
      // Fallback to shared.notifications
      const result = await pool.query<{ id: string }>(
        `INSERT INTO shared.notifications 
         (tenant_id, title, content, target_roles, priority, created_by, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          tenant.id,
          req.body.title,
          req.body.content,
          req.body.targetRoles,
          req.body.priority,
          user.id,
          req.body.expiresAt ? new Date(req.body.expiresAt) : null,
        ]
      );
      announcementId = result.rows[0].id;
    }

    // Audit log
    await createAuditLog(client, {
      userId: user.id,
      action: 'announcement:create',
      resourceType: 'announcement',
      resourceId: announcementId,
      details: {
        title: req.body.title,
        targetRoles: req.body.targetRoles,
        priority: req.body.priority,
      },
      severity: 'info',
      tags: ['announcement', 'admin'],
    });

    res
      .status(201)
      .json(createSuccessResponse({ id: announcementId }, 'Announcement created successfully'));
    return;
  } catch (error) {
    next(error);
    return;
  } finally {
    client.release();
  }
});

/**
 * GET /admin/announcements
 * List all announcements
 */
router.get(
  '/announcements',
  validateInput(
    z.object({
      limit: z.number().int().positive().max(100).optional().default(50),
      offset: z.number().int().nonnegative().optional().default(0),
      targetRole: z.enum(['admin', 'hod', 'teacher', 'student']).optional(),
    }),
    'query'
  ),
  async (req, res, next) => {
    const pool = getPool();
    try {
      const tenantCheck = verifyTenantContext(req.tenant, req.tenantClient);
      if (!tenantCheck.isValid) {
        return res.status(500).json(createErrorResponse(tenantCheck.error!));
      }

      // TypeScript: After validation, we know these are defined
      const tenant = req.tenant!;
      const schema = tenant.schema;
      const limit = Number(req.query.limit ?? 50);
      const offset = Number(req.query.offset ?? 0);
      let announcements: unknown[] = [];
      let total = 0;

      try {
        // Try tenant schema first
        const conditions: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (req.query.targetRole) {
          conditions.push(`$${paramIndex++} = ANY(target_roles)`);
          values.push(req.query.targetRole);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        if (!req.tenantClient) {
          return res.status(500).json(createErrorResponse('Tenant client not available'));
        }

        // Get total count
        const countResult = await req.tenantClient.query<{ count: string }>(
          `SELECT COUNT(*)::text as count FROM ${schema}.announcements ${whereClause}`,
          values
        );
        total = Number(countResult.rows[0]?.count ?? 0);

        // Get paginated results
        values.push(limit, offset);
        const result = await req.tenantClient.query(
          `SELECT 
          id, title, content, target_roles, priority, created_by, created_at, expires_at
         FROM ${schema}.announcements
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
          values
        );
        announcements = result.rows;
      } catch {
        // Fallback to shared.notifications
        const conditions: string[] = ['tenant_id = $1'];
        const values: unknown[] = [tenant.id];
        let paramIndex = 2;

        if (req.query.targetRole) {
          conditions.push(`$${paramIndex++} = ANY(target_roles)`);
          values.push(req.query.targetRole);
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;

        // Get total count
        const countResult = await pool.query<{ count: string }>(
          `SELECT COUNT(*)::text as count FROM shared.notifications ${whereClause}`,
          values
        );
        total = Number(countResult.rows[0]?.count ?? 0);

        // Get paginated results
        values.push(limit, offset);
        const result = await pool.query(
          `SELECT 
          id, title, content, target_roles, priority, created_by, created_at, expires_at
         FROM shared.notifications
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
          values
        );
        announcements = result.rows;
      }

      res.json(createSuccessResponse({ announcements, total }));
      return;
    } catch (error) {
      next(error);
      return;
    }
  }
);

export default router;
