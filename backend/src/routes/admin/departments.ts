/**
 * Admin Department Management Routes
 * Handles department CRUD operations within tenant context
 */

import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import tenantResolver from '../../middleware/tenantResolver';
import ensureTenantContext from '../../middleware/ensureTenantContext';
import { requirePermission } from '../../middleware/rbac';
import { validateInput } from '../../middleware/validateInput';
import { z } from 'zod';
import {
  createDepartment,
  listDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
  assignHODToDepartment
} from '../../services/admin/departmentService';
import { getPool } from '../../db/connection';
import { createSuccessResponse, createErrorResponse } from '../../lib/responseHelpers';
import { getSchoolIdForTenant, verifyTenantAndUserContext } from '../../services/shared/adminHelpers';

const router = Router();

router.use(authenticate, tenantResolver(), ensureTenantContext(), requirePermission('users:manage'));

const departmentSchema = z.object({
  name: z.string().min(1, 'Department name is required'),
  slug: z.string().optional(),
  contactEmail: z.string().email().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const updateDepartmentSchema = departmentSchema.partial();

/**
 * POST /admin/departments
 * Create a new department
 */
router.post('/', validateInput(departmentSchema, 'body'), async (req, res, next) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const contextCheck = verifyTenantAndUserContext(req.tenant, req.tenantClient, req.user);
    if (!contextCheck.isValid) {
      return res.status(500).json(createErrorResponse(contextCheck.error!));
    }

    // Get school ID for tenant
    const schoolId = await getSchoolIdForTenant(req.tenant!.id);
    if (!schoolId) {
      return res.status(404).json(createErrorResponse('School not found for tenant'));
    }

    // TypeScript: After validation, we know these are defined
    const tenantId = req.tenant!.id;
    const userId = req.user!.id;

    const department = await createDepartment(
      client,
      tenantId,
      schoolId,
      req.body,
      userId
    );

    res.status(201).json(createSuccessResponse(department, 'Department created successfully'));
  } catch (error) {
    next(error);
  } finally {
    client.release();
  }
});

/**
 * GET /admin/departments
 * List all departments
 */
router.get('/', async (req, res, next) => {
  try {
    if (!req.tenant) {
      return res.status(500).json(createErrorResponse('Tenant context missing'));
    }

    // Get school ID for tenant
    const schoolId = await getSchoolIdForTenant(req.tenant.id);
    if (!schoolId) {
      return res.status(404).json(createErrorResponse('School not found for tenant'));
    }

    const includeCounts = req.query.includeCounts !== 'false';
    const departments = await listDepartments(schoolId, includeCounts);

    res.json(createSuccessResponse(departments));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/departments/:id
 * Get department by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    if (!req.tenant) {
      return res.status(500).json(createErrorResponse('Tenant context missing'));
    }

    // Get school ID for tenant
    const schoolId = await getSchoolIdForTenant(req.tenant.id);
    if (!schoolId) {
      return res.status(404).json(createErrorResponse('School not found for tenant'));
    }

    const department = await getDepartmentById(req.params.id, schoolId);
    if (!department) {
      return res.status(404).json(createErrorResponse('Department not found'));
    }

    res.json(createSuccessResponse(department));
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /admin/departments/:id
 * Update department
 */
router.patch('/:id', validateInput(updateDepartmentSchema, 'body'), async (req, res, next) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const contextCheck = verifyTenantAndUserContext(req.tenant, req.tenantClient, req.user);
    if (!contextCheck.isValid) {
      return res.status(500).json(createErrorResponse(contextCheck.error!));
    }

    // Get school ID for tenant
    const schoolId = await getSchoolIdForTenant(req.tenant!.id);
    if (!schoolId) {
      return res.status(404).json(createErrorResponse('School not found for tenant'));
    }

    // TypeScript: After validation, we know these are defined
    const userId = req.user!.id;

    const department = await updateDepartment(
      client,
      req.params.id,
      schoolId,
      req.body,
      userId
    );

    res.json(createSuccessResponse(department, 'Department updated successfully'));
  } catch (error) {
    next(error);
  } finally {
    client.release();
  }
});

/**
 * DELETE /admin/departments/:id
 * Delete department
 */
router.delete('/:id', async (req, res, next) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const contextCheck = verifyTenantAndUserContext(req.tenant, req.tenantClient, req.user);
    if (!contextCheck.isValid) {
      return res.status(500).json(createErrorResponse(contextCheck.error!));
    }

    // Get school ID for tenant
    const schoolId = await getSchoolIdForTenant(req.tenant!.id);
    if (!schoolId) {
      return res.status(404).json(createErrorResponse('School not found for tenant'));
    }

    // TypeScript: After validation, we know these are defined
    const userId = req.user!.id;

    await deleteDepartment(client, req.params.id, schoolId, userId);

    res.json(createSuccessResponse(null, 'Department deleted successfully'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('Cannot delete')) {
      return res.status(400).json(createErrorResponse(error.message));
    }
    next(error);
  } finally {
    client.release();
  }
});

/**
 * PATCH /admin/departments/:id/assign-hod
 * Assign HOD to department
 */
router.patch('/:id/assign-hod', validateInput(z.object({
  userId: z.string().uuid('Invalid user ID')
}), 'body'), async (req, res, next) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const contextCheck = verifyTenantAndUserContext(req.tenant, req.tenantClient, req.user);
    if (!contextCheck.isValid) {
      return res.status(500).json(createErrorResponse(contextCheck.error!));
    }

    // Get school ID for tenant
    const schoolId = await getSchoolIdForTenant(req.tenant!.id);
    if (!schoolId) {
      return res.status(404).json(createErrorResponse('School not found for tenant'));
    }

    // TypeScript: After validation, we know these are defined
    const userId = req.user!.id;

    await assignHODToDepartment(
      client,
      req.params.id,
      schoolId,
      req.body.userId,
      userId
    );

    res.json(createSuccessResponse(null, 'HOD assigned to department successfully'));
  } catch (error) {
    next(error);
  } finally {
    client.release();
  }
});

export default router;

