import { Router } from 'express';
import { z } from 'zod';
import authenticate from '../../middleware/authenticate';
import { requireSuperuser } from '../../middleware/rbac';
import { getPool } from '../../db/connection';
import { getUserWithAdditionalRoles } from '../../services/userService';
import {
  getPermissionOverridesForUser,
  grantPermissionOverride,
  revokePermissionOverride,
} from '../../services/superuser/permissionOverrideService';
import { listOverrides, createOverride } from '../../services/superuser/overrideService';
import { updatePlatformUserStatus } from '../../services/platformMonitoringService';
import { adminResetPassword } from '../../services/superuser/passwordManagementService';
import { Role, Permission, rolePermissions } from '../../config/permissions';
import { createAuditLog } from '../../services/audit/enhancedAuditService';

const router = Router();

// All routes require superuser authentication
router.use(authenticate, requireSuperuser());

const bulkStatusUpdateSchema = z.object({
  userIds: z.array(z.string().uuid()),
  status: z.enum(['pending', 'active', 'suspended', 'rejected']),
  reason: z.string().optional(),
});

const bulkPasswordResetSchema = z.object({
  userIds: z.array(z.string().uuid()),
  reason: z.string().optional(),
});

const permissionOverrideSchema = z.object({
  permissions: z.array(z.string()),
  reason: z.string(),
  expiresAt: z
    .string()
    .refine((val) => val === undefined || val === null || !isNaN(Date.parse(val)), {
      message: 'Invalid datetime format',
    })
    .optional()
    .nullable(),
});

const overrideCreateSchema = z.object({
  action: z.string().min(1),
  reason: z.string().min(1),
  expiresAt: z
    .string()
    .refine((val) => val === undefined || val === null || !isNaN(Date.parse(val)), {
      message: 'Invalid datetime format',
    })
    .optional()
    .nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * GET /superuser/users/:userId
 * Get comprehensive user details
 */
router.get('/:userId', async (req, res, next) => {
  try {
    const pool = getPool();
    const userResult = await pool.query(
      `SELECT u.*, t.name as tenant_name 
       FROM shared.users u
       LEFT JOIN shared.tenants t ON u.tenant_id = t.id
       WHERE u.id = $1`,
      [req.params.userId]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    const user = userResult.rows[0];

    // Get additional roles if tenant exists
    let additionalRoles: Array<{ role: string; granted_at: string; granted_by?: string }> = [];
    if (user.tenant_id) {
      try {
        const userWithRoles = await getUserWithAdditionalRoles(user.id, user.tenant_id);
        additionalRoles = userWithRoles.additional_roles || [];
      } catch {
        // User might not have tenant, ignore
      }
    }

    res.json({
      ...user,
      additionalRoles,
    });
      return;
  } catch (error) {
    next(error);

    return;
  }
});

/**
 * GET /superuser/users/:userId/permissions
 * Get user permission analysis
 */
router.get('/:userId/permissions', async (req, res, next) => {
  try {
    const pool = getPool();
    const userResult = await pool.query(`SELECT tenant_id, role FROM shared.users WHERE id = $1`, [
      req.params.userId,
    ]);

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    const user = userResult.rows[0];
    if (!user.tenant_id) {
      return res.status(400).json({ message: 'User has no tenant assigned' });
    }
    const role = user.role as Role;
    const directPermissions = rolePermissions[role] || [];

    // Get additional roles
    let userWithRoles;
    try {
      userWithRoles = await getUserWithAdditionalRoles(req.params.userId, user.tenant_id);
    } catch {
      userWithRoles = { role, additional_roles: [] };
    }

    const additionalRolesPermissions: Permission[] = [];
    if (userWithRoles.additional_roles) {
      for (const additionalRole of userWithRoles.additional_roles) {
        const rolePerms = rolePermissions[additionalRole.role as Role] || [];
        additionalRolesPermissions.push(...rolePerms);
      }
    }

    // Get permission overrides
    const overrides = await getPermissionOverridesForUser(req.params.userId);

    // Calculate effective permissions
    const effectivePermissionsSet = new Set<Permission>([
      ...directPermissions,
      ...additionalRolesPermissions,
    ]);

    for (const override of overrides) {
      if (override.granted) {
        effectivePermissionsSet.add(override.permission as Permission);
      } else {
        effectivePermissionsSet.delete(override.permission as Permission);
      }
    }

    res.json({
      userId: req.params.userId,
      role,
      additionalRoles: userWithRoles.additional_roles || [],
      directPermissions,
      inheritedPermissions: additionalRolesPermissions,
      effectivePermissions: Array.from(effectivePermissionsSet),
      permissionOverrides: overrides.map((o) => ({
        permission: o.permission,
        granted: o.granted,
        reason: o.reason,
        expiresAt: o.expiresAt,
      })),
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

/**
 * PATCH /superuser/users/:userId/permissions
 * Override user permissions
 */
router.patch('/:userId/permissions', async (req, res, next) => {
  try {
    const parsed = permissionOverrideSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    const pool = getPool();
    const userResult = await pool.query(`SELECT tenant_id FROM shared.users WHERE id = $1`, [
      req.params.userId,
    ]);

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    const tenantId = userResult.rows[0].tenant_id;
    if (!tenantId) {
      return res.status(400).json({ message: 'User has no tenant assigned' });
    }
    const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined;

    // Get current effective permissions
    const currentPermissionsResult = await pool.query(
      `SELECT permission FROM shared.permission_overrides WHERE user_id = $1 AND granted = TRUE`,
      [req.params.userId]
    );
    const currentOverrides = new Set(currentPermissionsResult.rows.map((r) => r.permission));

    // Apply permission overrides
    for (const permission of parsed.data.permissions) {
      if (!currentOverrides.has(permission)) {
        await grantPermissionOverride(
          {
            userId: req.params.userId,
            permission: permission as Permission,
            reason: parsed.data.reason,
            expiresAt,
          },
          req.user?.id ?? ''
        );
      }
    }

    // Revoke permissions not in the list
    const permissionsToHave = new Set(parsed.data.permissions);
    for (const override of currentOverrides) {
      if (!permissionsToHave.has(override)) {
        await revokePermissionOverride(
          {
            userId: req.params.userId,
            permission: override as Permission,
            reason: parsed.data.reason,
          },
          req.user?.id ?? ''
        );
      }
    }

    // Audit log
    const client = await pool.connect();
    try {
      await createAuditLog(client, {
        tenantId: tenantId,
        userId: req.user?.id ?? '',
        action: 'PERMISSION_OVERRIDDEN',
        resourceType: 'user',
        resourceId: req.params.userId,
        details: {
          permissions: parsed.data.permissions,
          reason: parsed.data.reason,
          expiresAt: expiresAt,
        },
        severity: 'critical',
      });
    } finally {
      client.release();
    }

    // Return updated permissions
    const updatedPermissions = await getPermissionOverridesForUser(req.params.userId);
    res.json({
      userId: req.params.userId,
      permissionOverrides: updatedPermissions,
    });
      return;
  } catch (error) {
    next(error);

    return;
  }
});

/**
 * POST /superuser/users/bulk/status
 * Bulk update user status
 */
router.post('/bulk/status', async (req, res, next) => {
  try {
    const parsed = bulkStatusUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    const results = [];
    for (const userId of parsed.data.userIds) {
      try {
        const updated = await updatePlatformUserStatus(
          userId,
          parsed.data.status,
          req.user?.id ?? null
        );
        if (updated) {
          results.push({ userId, status: parsed.data.status, success: true });
        } else {
          results.push({ userId, status: null, success: false, error: 'User not found' });
        }
      } catch (error) {
        results.push({ userId, status: null, success: false, error: (error as Error).message });
      }
    }

    res.json({ results });
      return;
  } catch (error) {
    next(error);

    return;
  }
});

/**
 * POST /superuser/users/bulk/reset-password
 * Bulk reset passwords
 */
router.post('/bulk/reset-password', async (req, res, next) => {
  try {
    const parsed = bulkPasswordResetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    const pool = getPool();
    const results = [];
    for (const userId of parsed.data.userIds) {
      try {
        const userResult = await pool.query(`SELECT role FROM shared.users WHERE id = $1`, [
          userId,
        ]);
        if (userResult.rowCount === 0) {
          results.push({
            userId,
            temporaryPassword: null,
            success: false,
            error: 'User not found',
          });
          continue;
        }

        const result = await adminResetPassword(
          pool,
          userId,
          req.user?.id ?? '',
          (req.user?.role ?? 'superadmin') as Role,
          undefined,
          undefined,
          parsed.data.reason
        );
        results.push({ userId, temporaryPassword: result.temporaryPassword, success: true });
      } catch (error) {
        results.push({
          userId,
          temporaryPassword: null,
          success: false,
          error: (error as Error).message,
        });
      }
    }

    res.json({ results });
      return;
  } catch (error) {
    next(error);

    return;
  }
});

/**
 * POST /superuser/users/:userId/overrides
 * Create manual override for user
 */
router.post('/:userId/overrides', async (req, res, next) => {
  try {
    const parsed = overrideCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    const override = await createOverride(
      {
        overrideType: 'user_status',
        targetId: req.params.userId,
        action: parsed.data.action,
        reason: parsed.data.reason,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
        metadata: parsed.data.metadata,
      },
      req.user?.id ?? ''
    );

    res.status(201).json(override);
      return;
  } catch (error) {
    next(error);

    return;
  }
});

/**
 * GET /superuser/users/:userId/overrides
 * List overrides for user
 */
router.get('/:userId/overrides', async (req, res, next) => {
  try {
    const isActive =
      req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined;
    const overrides = await listOverrides({
      overrideType: 'user_status',
      targetId: req.params.userId,
      isActive,
    });

    res.json(overrides);
      return;
  } catch (error) {
    next(error);

    return;
  }
});

export default router;
