/**
 * Admin Users Routes
 * Handles admin-specific user management endpoints including HOD management
 */

import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import tenantResolver from '../../middleware/tenantResolver';
import ensureTenantContext from '../../middleware/ensureTenantContext';
import { requirePermission } from '../../middleware/rbac';
import { validateInput } from '../../middleware/validateInput';
import { updateHODDepartment, bulkRemoveHODRoles } from '../../services/userService';
import { createSuccessResponse, createErrorResponse } from '../../lib/responseHelpers';
import { z } from 'zod';

const router = Router();

router.use(authenticate, tenantResolver(), ensureTenantContext());

// PUT /admin/users/:id/department - Assign department to HOD
const departmentAssignmentSchema = z.object({
  department: z.string().min(1, 'Department is required')
});

router.put('/:id/department', requirePermission('users:manage'), validateInput(departmentAssignmentSchema, 'body'), async (req, res, next) => {
  try {
    if (!req.user || !req.tenant) {
      return res.status(500).json(createErrorResponse('User or tenant context missing'));
    }

    await updateHODDepartment(
      req.params.id,
      req.body.department,
      req.tenant.id,
      req.user.id
    );

    res.json(createSuccessResponse({ message: 'Department assigned successfully' }, 'Department assigned successfully'));
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('does not have HOD role')) {
        return res.status(400).json(createErrorResponse(error.message));
      }
      if (error.message.includes('does not exist')) {
        return res.status(500).json(createErrorResponse(error.message));
      }
    }
    next(error);
  }
});

// DELETE /admin/users/hod/bulk - Bulk remove HOD roles
const bulkRemoveHODSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1, 'At least one user ID is required')
});

router.delete('/hod/bulk', requirePermission('users:manage'), validateInput(bulkRemoveHODSchema, 'body'), async (req, res, next) => {
  try {
    if (!req.user || !req.tenant) {
      return res.status(500).json(createErrorResponse('User or tenant context missing'));
    }

    const { userIds } = req.body;
    const { removed, failed } = await bulkRemoveHODRoles(userIds, req.tenant.id, req.user.id);

    res.json(createSuccessResponse(
      {
        message: `${removed} HOD role(s) removed successfully${failed > 0 ? `, ${failed} failed` : ''}`,
        removed,
        failed
      },
      `${removed} HOD role(s) removed successfully${failed > 0 ? `, ${failed} failed` : ''}`
    ));
  } catch (error) {
    if (error instanceof Error && error.message.includes('does not exist')) {
      return res.status(500).json(createErrorResponse(error.message));
    }
    next(error);
  }
});

export default router;

