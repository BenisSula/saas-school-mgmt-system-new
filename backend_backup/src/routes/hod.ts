/**
 * HOD (Head of Department) Routes
 * Handles HOD-specific endpoints: dashboard, teacher oversight, department reports
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import ensureTenantContext from '../middleware/ensureTenantContext';
import { requireAnyPermission } from '../middleware/rbac';
import { validateInput } from '../middleware/validateInput';
import { z } from 'zod';
import { getHodOverview, listTeachersUnderHOD, getDepartmentReport } from '../services/hodService';
import { createSuccessResponse, createErrorResponse } from '../lib/responseHelpers';
import { isHOD } from '../lib/roleUtils';
import { getUserWithAdditionalRoles } from '../lib/roleUtils';
import { verifyTenantAndUserContext } from '../services/shared/adminHelpers';

const router = Router();

router.use(authenticate, tenantResolver(), ensureTenantContext());

/**
 * Middleware to verify user is HOD
 */
const verifyHOD = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !req.tenant || !req.tenantClient) {
    return res.status(401).json(createErrorResponse('Authentication required'));
  }

  // Get user with additional roles
  const user = await getUserWithAdditionalRoles(
    req.tenantClient,
    req.user.id,
    req.tenant.id
  );

  if (!user || !isHOD(user)) {
    return res.status(403).json(createErrorResponse('Access denied. HOD role required.'));
  }

  // Attach user with roles to request
  (req as Request & { hodUser: typeof user }).hodUser = user;
  next();
};

router.use(verifyHOD);

/**
 * GET /hod/dashboard
 * Get HOD overview dashboard
 */
router.get('/dashboard', requireAnyPermission('department-analytics', 'grades:manage'), async (req, res, next) => {
  try {
    const contextCheck = verifyTenantAndUserContext(req.tenant, req.tenantClient, req.user);
    if (!contextCheck.isValid) {
      return res.status(500).json(createErrorResponse(contextCheck.error!));
    }

    // TypeScript assertion: context check ensures these are defined
    const tenant = req.tenant!;
    const tenantClient = req.tenantClient!;
    const user = req.user!;

    const overview = await getHodOverview(
      tenantClient,
      tenant.id,
      tenant.schema,
      user.id
    );

    res.json(createSuccessResponse(overview, 'HOD dashboard retrieved successfully'));
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('not assigned')) {
        return res.status(404).json(createErrorResponse(error.message));
      }
    }
    next(error);
  }
});

/**
 * GET /hod/teachers
 * List teachers under HOD's department
 */
const listTeachersQuerySchema = z.object({
  search: z.string().optional(),
  subject: z.string().optional()
});

router.get('/teachers', 
  requireAnyPermission('department-analytics', 'grades:manage'),
  validateInput(listTeachersQuerySchema, 'query'),
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

      const teachers = await listTeachersUnderHOD(
        tenantClient,
        tenant.id,
        tenant.schema,
        user.id,
        {
          search: req.query.search as string | undefined,
          subject: req.query.subject as string | undefined
        }
      );

      res.json(createSuccessResponse(teachers, 'Teachers retrieved successfully'));
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('not assigned')) {
          return res.status(404).json(createErrorResponse(error.message));
        }
      }
      next(error);
    }
  }
);

/**
 * GET /hod/reports/department
 * Get department-level report
 */
const departmentReportQuerySchema = z.object({
  term: z.string().optional(),
  classId: z.string().optional(),
  subjectId: z.string().optional()
});

router.get('/reports/department',
  requireAnyPermission('department-analytics', 'reports:view'),
  validateInput(departmentReportQuerySchema, 'query'),
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

      const report = await getDepartmentReport(
        tenantClient,
        tenant.id,
        tenant.schema,
        user.id,
        {
          term: req.query.term as string | undefined,
          classId: req.query.classId as string | undefined,
          subjectId: req.query.subjectId as string | undefined
        }
      );

      res.json(createSuccessResponse(report, 'Department report retrieved successfully'));
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('not assigned')) {
          return res.status(404).json(createErrorResponse(error.message));
        }
      }
      next(error);
    }
  }
);

export default router;

