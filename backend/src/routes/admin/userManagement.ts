/**
 * Admin User Management Routes
 * Handles user creation (HOD, Teacher, Student) and management within tenant
 */

import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import tenantResolver from '../../middleware/tenantResolver';
import ensureTenantContext from '../../middleware/ensureTenantContext';
import { requirePermission } from '../../middleware/rbac';
import { validateInput } from '../../middleware/validateInput';
import { adminCreateUser } from '../../services/adminUserService';
import { getPool } from '../../db/connection';
import { createSuccessResponse, createErrorResponse } from '../../lib/responseHelpers';
import { listTenantUsers } from '../../services/userService';
import {
  verifyTenantAndUserContext,
  verifyTenantContext,
} from '../../services/shared/adminHelpers';
import { createAuditLog } from '../../services/audit/enhancedAuditService';
import {
  createHODSchema,
  createTeacherSchema,
  createStudentSchema,
} from '../../validators/userRegistrationValidator';

const router = Router();

router.use(
  authenticate,
  tenantResolver(),
  ensureTenantContext(),
  requirePermission('users:manage')
);

// User registration schemas imported from validators

/**
 * POST /admin/users/hod/create
 * Create a new HOD
 */
router.post('/hod/create', validateInput(createHODSchema, 'body'), async (req, res, next) => {
  try {
    const contextCheck = verifyTenantAndUserContext(req.tenant, req.tenantClient, req.user);
    if (!contextCheck.isValid) {
      return res.status(500).json(createErrorResponse(contextCheck.error!));
    }

    // TypeScript assertion: context check ensures these are defined
    const tenant = req.tenant!;
    const tenantClient = req.tenantClient!;
    const user = req.user!;

    const result = await adminCreateUser(
      tenant.id,
      tenantClient,
      tenant.schema,
      {
        ...req.body,
        role: 'hod',
      },
      user.id
    );

    res.status(201).json(createSuccessResponse(result, 'HOD created successfully'));
    return;
  } catch (error) {
    if (error instanceof Error && error.message.includes('already in use')) {
      return res.status(400).json(createErrorResponse(error.message));
    }
    next(error);
    return;
  }
});

/**
 * POST /admin/users/teacher/create
 * Create a new teacher
 */
router.post(
  '/teacher/create',
  validateInput(createTeacherSchema, 'body'),
  async (req, res, next) => {
    try {
      const contextCheck = verifyTenantAndUserContext(req.tenant, req.tenantClient, req.user);
      if (!contextCheck.isValid) {
        return res.status(500).json(createErrorResponse(contextCheck.error!));
      }

      // TypeScript assertion: context check ensures these are defined
      const tenant = req.tenant!;
      const tenantClient = req.tenantClient!;
      const user = req.user!;

      const result = await adminCreateUser(
        tenant.id,
        tenantClient,
        tenant.schema,
        {
          ...req.body,
          role: 'teacher',
        },
        user.id
      );

      res.status(201).json(createSuccessResponse(result, 'Teacher created successfully'));
      return;
    } catch (error) {
      if (error instanceof Error && error.message.includes('already in use')) {
        return res.status(400).json(createErrorResponse(error.message));
      }
      next(error);
      return;
    }
  }
);

/**
 * POST /admin/users/student/create
 * Create a new student
 */
router.post(
  '/student/create',
  validateInput(createStudentSchema, 'body'),
  async (req, res, next) => {
    try {
      const contextCheck = verifyTenantAndUserContext(req.tenant, req.tenantClient, req.user);
      if (!contextCheck.isValid) {
        return res.status(500).json(createErrorResponse(contextCheck.error!));
      }

      // TypeScript assertion: context check ensures these are defined
      const tenant = req.tenant!;
      const tenantClient = req.tenantClient!;
      const user = req.user!;

      const result = await adminCreateUser(
        tenant.id,
        tenantClient,
        tenant.schema,
        {
          ...req.body,
          role: 'student',
        },
        user.id
      );

      res.status(201).json(createSuccessResponse(result, 'Student created successfully'));
      return;
    } catch (error) {
      if (error instanceof Error && error.message.includes('already in use')) {
        return res.status(400).json(createErrorResponse(error.message));
      }
      next(error);
      return;
    }
  }
);

/**
 * GET /admin/users
 * List all users with optional filters
 */
router.get('/', async (req, res, next) => {
  try {
    const tenantCheck = verifyTenantContext(req.tenant, req.tenantClient);
    if (!tenantCheck.isValid) {
      return res.status(500).json(createErrorResponse(tenantCheck.error!));
    }

    // TypeScript assertion: context check ensures this is defined
    const tenant = req.tenant!;

    const filters: { status?: string; role?: string } = {};
    if (req.query.status) {
      filters.status = req.query.status as string;
    }
    if (req.query.role) {
      filters.role = req.query.role as string;
    }

    const users = await listTenantUsers(tenant.id, filters);

    res.json(createSuccessResponse(users));
    return;
  } catch (error) {
    next(error);
    return;
  }
});

/**
 * PATCH /admin/users/:id/disable
 * Disable a user account
 */
router.patch('/:id/disable', async (req, res, next) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const contextCheck = verifyTenantAndUserContext(req.tenant, req.tenantClient, req.user);
    if (!contextCheck.isValid) {
      return res.status(500).json(createErrorResponse(contextCheck.error!));
    }

    // TypeScript assertion: context check ensures these are defined
    const tenant = req.tenant!;
    const user = req.user!;

    // Verify user belongs to tenant
    const userCheck = await pool.query(
      `SELECT id, status FROM shared.users WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, tenant.id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('User not found'));
    }

    if (userCheck.rows[0].status === 'disabled') {
      return res.status(400).json(createErrorResponse('User is already disabled'));
    }

    // Disable user
    await pool.query(
      `UPDATE shared.users SET status = 'disabled', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );

    // Audit log
    await createAuditLog(client, {
      userId: user.id,
      action: 'user:disable',
      resourceType: 'user',
      resourceId: req.params.id,
      details: { targetUserId: req.params.id },
      severity: 'info',
      tags: ['user', 'admin'],
    });

    res.json(createSuccessResponse(null, 'User disabled successfully'));
    return;
  } catch (error) {
    next(error);
    return;
  } finally {
    client.release();
  }
});

/**
 * PATCH /admin/users/:id/enable
 * Enable a user account
 */
router.patch('/:id/enable', async (req, res, next) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const contextCheck = verifyTenantAndUserContext(req.tenant, req.tenantClient, req.user);
    if (!contextCheck.isValid) {
      return res.status(500).json(createErrorResponse(contextCheck.error!));
    }

    // TypeScript assertion: context check ensures these are defined
    const tenant = req.tenant!;
    const user = req.user!;

    // Verify user belongs to tenant
    const userCheck = await pool.query(
      `SELECT id, status FROM shared.users WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, tenant.id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('User not found'));
    }

    if (userCheck.rows[0].status === 'active') {
      return res.status(400).json(createErrorResponse('User is already active'));
    }

    // Enable user
    await pool.query(
      `UPDATE shared.users SET status = 'active', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );

    // Audit log
    await createAuditLog(client, {
      userId: user.id,
      action: 'user:enable',
      resourceType: 'user',
      resourceId: req.params.id,
      details: { targetUserId: req.params.id },
      severity: 'info',
      tags: ['user', 'admin'],
    });

    res.json(createSuccessResponse(null, 'User enabled successfully'));
    return;
  } catch (error) {
    next(error);
    return;
  } finally {
    client.release();
  }
});

export default router;
