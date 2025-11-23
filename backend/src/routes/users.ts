import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import ensureTenantContext from '../middleware/ensureTenantContext';
import { requirePermission } from '../middleware/rbac';
import { validateInput } from '../middleware/validateInput';
import { createPaginatedResponse } from '../middleware/pagination';
import { listTenantUsers, updateTenantUserRole, updateUserStatus, updateHODDepartment, bulkRemoveHODRoles } from '../services/userService';
import { processPendingProfile, cleanupPendingProfile } from '../services/profileService';
import { adminCreateUser } from '../services/adminUserService';
import { roleUpdateSchema } from '../validators/userValidator';
import { getPool } from '../db/connection';
import { z } from 'zod';
import adminPasswordsRouter from './admin/passwords';

const router = Router();

router.use(authenticate, tenantResolver(), ensureTenantContext());

// Mount admin password routes
router.use('/admin', adminPasswordsRouter);

// Import user registration schema from validators
import { adminCreateUserSchema } from '../validators/userRegistrationValidator';

// Admin endpoint: Create new user with profile
router.post('/register', requirePermission('users:manage'), validateInput(adminCreateUserSchema, 'body'), async (req, res, next) => {
  try {
    if (!req.user || !req.tenant || !req.tenantClient) {
      return res.status(500).json({ message: 'User or tenant context missing' });
    }

    const result = await adminCreateUser(
      req.tenant.id,
      req.tenantClient,
      req.tenant.schema,
      req.body,
      req.user.id
    );

    res.status(201).json(result);
  } catch (error) {
    console.error('[users] Admin user creation error:', error);
    if (error instanceof Error && error.message.includes('already exists')) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }
    next(error);
  }
});

router.get('/', requirePermission('users:manage'), async (req, res, next) => {
  try {
    if (!req.tenant) {
      return res.status(400).json({ message: 'Tenant context required' });
    }
    const pagination = req.pagination!;
    const { status, role } = req.query;
    const filters: { status?: string; role?: string } = {};
    if (status && typeof status === 'string') {
      filters.status = status;
    }
    if (role && typeof role === 'string') {
      filters.role = role;
    }
    const allUsers = await listTenantUsers(req.tenant.id, filters);
    
    // Apply pagination
    const paginated = allUsers.slice(pagination.offset, pagination.offset + pagination.limit);
    const response = createPaginatedResponse(paginated, allUsers.length, pagination);
    
    res.json(response);
  } catch (error) {
    console.error('Error in /users route:', error);
    if (!res.headersSent) {
      res.status(500).json({
        message: 'Failed to list users',
        error: (error as Error).message
      });
    } else {
      next(error);
    }
  }
});

router.patch('/:userId/role', requirePermission('users:manage'), validateInput(roleUpdateSchema, 'body'), async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(500).json({ message: 'User context missing' });
    }

    const updated = await updateTenantUserRole(
      req.tenant!.id,
      req.params.userId,
      req.body.role,
      req.user.id
    );

    if (!updated) {
      return res.status(404).json({ message: 'User not found for tenant' });
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.patch('/:userId/approve', requirePermission('users:manage'), async (req, res, next) => {
  try {
    if (!req.user || !req.tenant || !req.tenantClient) {
      return res.status(500).json({ message: 'User or tenant context missing' });
    }

    // Get user info before updating status (to check for pending profile data)
    const pool = getPool();
    const mainClient = await pool.connect();
    let userInfo: { email: string; role: string; pending_profile_data: unknown } | null = null;

    try {
      const userResult = await mainClient.query(
        `SELECT email, role, pending_profile_data FROM shared.users WHERE id = $1 AND tenant_id = $2`,
        [req.params.userId, req.tenant.id]
      );
      if (userResult.rowCount && userResult.rowCount > 0) {
        userInfo = userResult.rows[0];
      }
    } finally {
      mainClient.release();
    }

    // Update user status
    const updated = await updateUserStatus(
      req.tenant.id,
      req.params.userId,
      'active',
      req.user.id
    );

    if (!updated) {
      return res.status(404).json({ message: 'User not found for tenant' });
    }

    // Process pending profile data if exists (create student/teacher records)
    if (userInfo && userInfo.pending_profile_data) {
      try {
        const profileResult = await processPendingProfile(
          req.tenantClient,
          req.tenant.schema,
          req.params.userId,
          userInfo.email,
          userInfo.role
        );
        if (!profileResult.success) {
          console.error('[users] Failed to process profile on approval:', profileResult.error);
          // Don't fail the approval, but log the error
        }
      } catch (profileError) {
        console.error('[users] Error processing profile on approval:', profileError);
        // Don't fail the approval, but log the error
      }
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.patch('/:userId/reject', requirePermission('users:manage'), async (req, res, next) => {
  try {
    if (!req.user || !req.tenant) {
      return res.status(500).json({ message: 'User or tenant context missing' });
    }

    // Get user info before updating status (to check for pending profile data)
    const pool = getPool();
    const mainClient = await pool.connect();
    let hasPendingProfile = false;

    try {
      const userResult = await mainClient.query(
        `SELECT pending_profile_data FROM shared.users WHERE id = $1 AND tenant_id = $2`,
        [req.params.userId, req.tenant.id]
      );
      if (userResult.rowCount && userResult.rowCount > 0) {
        hasPendingProfile = userResult.rows[0].pending_profile_data !== null;
      }
    } finally {
      mainClient.release();
    }

    // Update user status to rejected
    const updated = await updateUserStatus(
      req.tenant.id,
      req.params.userId,
      'rejected',
      req.user.id
    );

    if (!updated) {
      return res.status(404).json({ message: 'User not found for tenant' });
    }

    // Clean up pending profile data (automatically dropped on rejection)
    if (hasPendingProfile) {
      try {
        const cleanupResult = await cleanupPendingProfile(req.tenant.id, req.params.userId);
        if (!cleanupResult.success) {
          console.error('[users] Failed to cleanup profile on rejection:', cleanupResult.error);
          // Don't fail the rejection, but log the error
        }
      } catch (cleanupError) {
        console.error('[users] Error cleaning up profile on rejection:', cleanupError);
        // Don't fail the rejection, but log the error
      }
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// PUT /admin/users/:id/department - Assign department to HOD
const departmentAssignmentSchema = z.object({
  department: z.string().min(1, 'Department is required')
});

router.put('/:userId/department', requirePermission('users:manage'), validateInput(departmentAssignmentSchema, 'body'), async (req, res, next) => {
  try {
    if (!req.user || !req.tenant) {
      return res.status(500).json({ message: 'User or tenant context missing' });
    }

    await updateHODDepartment(
      req.params.userId,
      req.body.department,
      req.tenant.id,
      req.user.id
    );

    res.json({ message: 'Department assigned successfully' });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('does not have HOD role')) {
        return res.status(400).json({ message: error.message });
      }
      if (error.message.includes('does not exist')) {
        return res.status(500).json({ message: error.message });
      }
    }
    next(error);
  }
});

// Bulk HOD role removal endpoint
const bulkRemoveHODSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1, 'At least one user ID is required')
});

router.delete('/hod/bulk', requirePermission('users:manage'), validateInput(bulkRemoveHODSchema, 'body'), async (req, res, next) => {
  try {
    if (!req.user || !req.tenant) {
      return res.status(500).json({ message: 'User or tenant context missing' });
    }

    const { userIds } = req.body;
    const { removed, failed } = await bulkRemoveHODRoles(userIds, req.tenant.id, req.user.id);

    res.json({
      message: `${removed} HOD role(s) removed successfully${failed > 0 ? `, ${failed} failed` : ''}`,
      removed,
      failed
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('does not exist')) {
      return res.status(500).json({ message: error.message });
    }
    next(error);
  }
});

export default router;
