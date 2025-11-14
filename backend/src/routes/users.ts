import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import ensureTenantContext from '../middleware/ensureTenantContext';
import { requirePermission } from '../middleware/rbac';
import { listTenantUsers, updateTenantUserRole, updateUserStatus } from '../services/userService';
import { roleUpdateSchema } from '../validators/userValidator';

const router = Router();

router.use(authenticate, tenantResolver(), ensureTenantContext());

router.get('/', requirePermission('users:manage'), async (req, res, next) => {
  try {
    if (!req.tenant) {
      return res.status(400).json({ message: 'Tenant context required' });
    }
    const { status, role } = req.query;
    const filters: { status?: string; role?: string } = {};
    if (status && typeof status === 'string') {
      filters.status = status;
    }
    if (role && typeof role === 'string') {
      filters.role = role;
    }
    const users = await listTenantUsers(req.tenant.id, filters);
    res.json(users);
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

router.patch('/:userId/role', requirePermission('users:manage'), async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(500).json({ message: 'User context missing' });
    }

    const parsed = roleUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const updated = await updateTenantUserRole(
      req.tenant!.id,
      req.params.userId,
      parsed.data.role,
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
    if (!req.user) {
      return res.status(500).json({ message: 'User context missing' });
    }

    const updated = await updateUserStatus(
      req.tenant!.id,
      req.params.userId,
      'active',
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

router.patch('/:userId/reject', requirePermission('users:manage'), async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(500).json({ message: 'User context missing' });
    }

    const updated = await updateUserStatus(
      req.tenant!.id,
      req.params.userId,
      'rejected',
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

export default router;
