import { Router } from 'express';
import { z } from 'zod';
import authenticate from '../../middleware/authenticate';
import { requireSuperuser } from '../../middleware/rbac';
import { Role, Permission, rolePermissions } from '../../config/permissions';
import { getPool } from '../../db/connection';
import { createAuditLog } from '../../services/audit/enhancedAuditService';

const router = Router();

// All routes require superuser authentication
router.use(authenticate, requireSuperuser());

const rolePermissionsUpdateSchema = z.object({
  permissions: z.array(z.string()),
  reason: z.string()
});

/**
 * GET /superuser/roles/permissions
 * Get role permissions matrix
 */
router.get('/permissions', async (req, res, next) => {
  try {
    res.json(rolePermissions);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /superuser/roles/permissions/propagation
 * Get permission propagation hierarchy
 */
router.get('/permissions/propagation', async (req, res, next) => {
  try {
    const hierarchy: Array<{ role: Role; level: number }> = [
      { role: 'superadmin', level: 5 },
      { role: 'admin', level: 4 },
      { role: 'hod', level: 3 },
      { role: 'teacher', level: 2 },
      { role: 'student', level: 1 }
    ];
    
    res.json({
      hierarchy,
      permissions: rolePermissions
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /superuser/roles/:role/permissions/impact
 * Get impact analysis for role permission changes
 */
router.get('/:role/permissions/impact', async (req, res, next) => {
  try {
    const role = req.params.role as Role;
    if (!rolePermissions[role]) {
      return res.status(404).json({ message: 'Role not found' });
    }
    
    const proposedPermissions = req.query.proposedPermissions 
      ? JSON.parse(req.query.proposedPermissions as string) as Permission[]
      : [];
    
    const currentPermissions = rolePermissions[role] || [];
    const currentSet = new Set(currentPermissions);
    const proposedSet = new Set(proposedPermissions);
    
    const addedPermissions = proposedPermissions.filter((p) => !currentSet.has(p));
    const removedPermissions = currentPermissions.filter((p) => !proposedSet.has(p));
    
    const pool = getPool();
    const userCountResult = await pool.query(
      `SELECT COUNT(*) as count FROM shared.users WHERE role = $1`,
      [role]
    );
    
    const affectedUsers = parseInt(userCountResult.rows[0].count, 10);
    
    res.json({
      affectedUsers,
      currentPermissions,
      proposedPermissions,
      addedPermissions,
      removedPermissions
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /superuser/roles/:role/permissions
 * Update role permissions (audit only, actual permissions are in code)
 */
router.patch('/:role/permissions', async (req, res, next) => {
  try {
    if (req.params.role === 'superadmin') {
      return res.status(403).json({ message: 'Cannot modify superadmin role permissions' });
    }
    
    const role = req.params.role as Role;
    if (!rolePermissions[role]) {
      return res.status(404).json({ message: 'Role not found' });
    }
    
    const parsed = rolePermissionsUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      const currentPermissions = rolePermissions[role] || [];
      const currentSet = new Set(currentPermissions);
      const proposedSet = new Set(parsed.data.permissions);
      
      const addedPermissions = parsed.data.permissions.filter((p) => {
        const perm = p as Permission;
        return !currentSet.has(perm);
      });
      const removedPermissions = currentPermissions.filter((p) => {
        const perm = p as Permission;
        return !proposedSet.has(perm);
      });
      
      const userCountResult = await pool.query(
        `SELECT COUNT(*) as count FROM shared.users WHERE role = $1`,
        [role]
      );
      const affectedUsers = parseInt(userCountResult.rows[0].count, 10);
      
      await createAuditLog(
        client,
        {
          tenantId: undefined,
          userId: req.user?.id ?? '',
          action: 'ROLE_PERMISSIONS_CHANGED',
          resourceType: 'role',
          resourceId: role,
          details: {
            role,
            currentPermissions,
            proposedPermissions: parsed.data.permissions,
            addedPermissions,
            removedPermissions,
            affectedUsers,
            reason: parsed.data.reason,
            note: 'Permission changes require code deployment to take effect'
          },
          severity: 'critical'
        }
      );
      
      res.json({ 
        success: true,
        message: 'Permission change logged. Note: Actual permission changes require code deployment.',
        impact: {
          affectedUsers,
          addedPermissions,
          removedPermissions
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

export default router;

