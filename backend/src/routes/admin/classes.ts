/**
 * Admin Class Management Routes
 * Handles class CRUD operations within tenant schema
 */

import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import tenantResolver from '../../middleware/tenantResolver';
import ensureTenantContext from '../../middleware/ensureTenantContext';
import { requirePermission } from '../../middleware/rbac';
import { validateInput } from '../../middleware/validateInput';
import { validateUuidParam } from '../../middleware/validateParams';
import { z } from 'zod';
import {
  createClass,
  listClasses,
  getClassById,
  updateClass,
  deleteClass,
  assignClassTeacher,
  assignStudentsToClass,
} from '../../services/admin/classService';
import { getPool } from '../../db/connection';
import { createSuccessResponse, createErrorResponse } from '../../lib/responseHelpers';
import { verifyTenantAndUserContext } from '../../services/shared/adminHelpers';

const router = Router();

router.use(
  authenticate,
  tenantResolver(),
  ensureTenantContext(),
  requirePermission('users:manage')
);

const classSchema = z.object({
  name: z.string().min(1, 'Class name is required'),
  description: z.string().optional().nullable(),
  gradeLevel: z.string().optional().nullable(),
  section: z.string().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  academicYear: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateClassSchema = classSchema.partial();

/**
 * POST /admin/classes
 * Create a new class
 */
router.post('/', validateInput(classSchema, 'body'), async (req, res, next) => {
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

    const classRecord = await createClass(tenantClient, tenant.schema, req.body, user.id);

    res.status(201).json(createSuccessResponse(classRecord, 'Class created successfully'));
    return;
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      return res.status(400).json(createErrorResponse(error.message));
    }
    next(error);
    return;
  } finally {
    client.release();
  }
});

/**
 * GET /admin/classes
 * List all classes
 */
router.get('/', async (req, res, next) => {
  try {
    if (!req.tenant || !req.tenantClient) {
      return res.status(500).json(createErrorResponse('Tenant context missing'));
    }
    // Note: No user context needed for read operations

    const includeCounts = req.query.includeCounts !== 'false';
    const classes = await listClasses(req.tenantClient, req.tenant.schema, includeCounts);

    res.json(createSuccessResponse(classes));
    return;
  } catch (error) {
    next(error);
    return;
  }
});

/**
 * GET /admin/classes/:id
 * Get class by ID
 */
router.get('/:id', validateUuidParam('id'), async (req, res, next) => {
  try {
    if (!req.tenant || !req.tenantClient) {
      return res.status(500).json(createErrorResponse('Tenant context missing'));
    }

    const classRecord = await getClassById(req.tenantClient, req.tenant.schema, req.params.id);
    if (!classRecord) {
      return res.status(404).json(createErrorResponse('Class not found'));
    }

    res.json(createSuccessResponse(classRecord));
    return;
  } catch (error) {
    next(error);
    return;
  }
});

/**
 * PATCH /admin/classes/:id
 * Update class
 */
router.patch(
  '/:id',
  validateUuidParam('id'),
  validateInput(updateClassSchema, 'body'),
  async (req, res, next) => {
    try {
      const contextCheck = verifyTenantAndUserContext(req.tenant, req.tenantClient, req.user);
      if (!contextCheck.isValid) {
        return res.status(500).json(createErrorResponse(contextCheck.error!));
      }

      // TypeScript: After validation, we know these are defined
      const tenant = req.tenant!;
      const tenantClient = req.tenantClient!;
      const user = req.user!;

      const classRecord = await updateClass(
        tenantClient,
        tenant.schema,
        req.params.id,
        req.body,
        user.id
      );

      res.json(createSuccessResponse(classRecord, 'Class updated successfully'));
      return;
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        return res.status(400).json(createErrorResponse(error.message));
      }
      next(error);
      return;
    }
  }
);

/**
 * DELETE /admin/classes/:id
 * Delete class
 */
router.delete('/:id', validateUuidParam('id'), async (req, res, next) => {
  try {
    const contextCheck = verifyTenantAndUserContext(req.tenant, req.tenantClient, req.user);
    if (!contextCheck.isValid) {
      return res.status(500).json(createErrorResponse(contextCheck.error!));
    }

    // TypeScript: After validation, we know these are defined
    const tenant = req.tenant!;
    const tenantClient = req.tenantClient!;
    const user = req.user!;

    await deleteClass(tenantClient, tenant.schema, req.params.id, user.id);

    res.json(createSuccessResponse(null, 'Class deleted successfully'));
    return;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Cannot delete')) {
      return res.status(400).json(createErrorResponse(error.message));
    }
    next(error);
    return;
  }
});

/**
 * PATCH /admin/classes/:id/assign-teacher
 * Assign class teacher
 */
router.patch(
  '/:id/assign-teacher',
  validateUuidParam('id'),
  validateInput(
    z.object({
      teacherUserId: z.string().uuid('Invalid teacher user ID'),
    }),
    'body'
  ),
  async (req, res, next) => {
    try {
      const contextCheck = verifyTenantAndUserContext(req.tenant, req.tenantClient, req.user);
      if (!contextCheck.isValid) {
        return res.status(500).json(createErrorResponse(contextCheck.error!));
      }

      // TypeScript: After validation, we know these are defined
      const tenant = req.tenant!;
      const tenantClient = req.tenantClient!;
      const user = req.user!;

      await assignClassTeacher(
        tenantClient,
        tenant.schema,
        req.params.id,
        req.body.teacherUserId,
        user.id
      );

      res.json(createSuccessResponse(null, 'Class teacher assigned successfully'));
      return;
    } catch (error) {
      next(error);
      return;
    }
  }
);

/**
 * POST /admin/classes/:id/assign-students
 * Assign students to class
 */
router.post(
  '/:id/assign-students',
  validateUuidParam('id'),
  validateInput(
    z.object({
      studentIds: z.array(z.string().uuid()).min(1, 'At least one student ID is required'),
    }),
    'body'
  ),
  async (req, res, next) => {
    try {
      const contextCheck = verifyTenantAndUserContext(req.tenant, req.tenantClient, req.user);
      if (!contextCheck.isValid) {
        return res.status(500).json(createErrorResponse(contextCheck.error!));
      }

      // TypeScript: After validation, we know these are defined
      const tenant = req.tenant!;
      const tenantClient = req.tenantClient!;
      const user = req.user!;

      const result = await assignStudentsToClass(
        tenantClient,
        tenant.schema,
        req.params.id,
        req.body.studentIds,
        user.id
      );

      res.json(
        createSuccessResponse(
          result,
          `Assigned ${result.assigned} student(s), ${result.failed} failed`
        )
      );
      return;
    } catch (error) {
      next(error);
      return;
    }
  }
);

export default router;
