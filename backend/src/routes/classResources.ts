/**
 * Class Resources Routes
 * Handles class resources management endpoints
 */

import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import ensureTenantContext from '../middleware/ensureTenantContext';
import { requirePermission } from '../middleware/rbac';
import { validateInput } from '../middleware/validateInput';
import { createPaginatedResponse } from '../middleware/pagination';
import {
  listClassResources,
  getClassResource,
  createClassResource,
  updateClassResource,
  deleteClassResource,
} from '../services/classResources/unifiedClassResourcesService';
import {
  createClassResourceSchema,
  updateClassResourceSchema,
} from '../validators/classResourcesValidator';
import { createSuccessResponse, createErrorResponse } from '../lib/responseHelpers';

const router = Router();

router.use(authenticate, tenantResolver(), ensureTenantContext());

/**
 * GET /class-resources
 * List all class resources with pagination and filters
 */
router.get('/', requirePermission('class-resources:read'), async (req, res, next) => {
  try {
    if (!req.tenant || !req.tenantClient) {
      return res.status(500).json(createErrorResponse('Tenant context missing'));
    }

    const pagination = req.pagination!;
    const filters = {
      classId: req.query.classId as string | undefined,
      resourceType: req.query.resourceType as string | undefined,
      ...req.query,
    };

    const items = await listClassResources(
      req.tenantClient,
      req.tenant.schema,
      filters,
      pagination || { limit: 50, offset: 0 }
    );

    return res.json(createPaginatedResponse(items, items.length, pagination));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /class-resources/:id
 * Get a single class resource by ID
 */
router.get('/:id', requirePermission('class-resources:read'), async (req, res, next) => {
  try {
    if (!req.tenant || !req.tenantClient) {
      return res.status(500).json(createErrorResponse('Tenant context missing'));
    }

    const item = await getClassResource(req.tenantClient, req.tenant.schema, req.params.id);

    if (!item) {
      return res.status(404).json(createErrorResponse('Class resource not found'));
    }

    return res.json(createSuccessResponse(item));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /class-resources
 * Create a new class resource
 */
router.post(
  '/',
  requirePermission('class-resources:create'),
  validateInput(createClassResourceSchema),
  async (req, res, next) => {
    try {
      if (!req.tenant || !req.tenantClient) {
        return res.status(500).json(createErrorResponse('Tenant context missing'));
      }

      const item = await createClassResource(
        req.tenantClient,
        req.tenant.schema,
        req.body,
        req.user!.id,
        req.tenant.id
      );

      return res.status(201).json(createSuccessResponse(item));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /class-resources/:id
 * Update an existing class resource
 */
router.put(
  '/:id',
  requirePermission('class-resources:update'),
  validateInput(updateClassResourceSchema),
  async (req, res, next) => {
    try {
      if (!req.tenant || !req.tenantClient) {
        return res.status(500).json(createErrorResponse('Tenant context missing'));
      }

      const item = await updateClassResource(
        req.tenantClient,
        req.tenant.schema,
        req.params.id,
        req.body,
        req.user!.id
      );

      if (!item) {
        return res.status(404).json(createErrorResponse('Class resource not found'));
      }

      return res.json(createSuccessResponse(item));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /class-resources/:id
 * Delete a class resource
 */
router.delete('/:id', requirePermission('class-resources:delete'), async (req, res, next) => {
  try {
    if (!req.tenant || !req.tenantClient) {
      return res.status(500).json(createErrorResponse('Tenant context missing'));
    }

    const deleted = await deleteClassResource(
      req.tenantClient,
      req.tenant.schema,
      req.params.id,
      req.user!.id,
      undefined // No teacherId for admin deletion
    );

    if (!deleted) {
      return res.status(404).json(createErrorResponse('Class resource not found'));
    }

    return res.json(createSuccessResponse({ deleted: true }));
  } catch (error) {
    next(error);
  }
});

export default router;
