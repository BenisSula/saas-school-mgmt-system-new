import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import ensureTenantContext from '../middleware/ensureTenantContext';
import { requireAnyPermission, requirePermission } from '../middleware/rbac';
import { validateInput } from '../middleware/validateInput';
import { createPaginatedResponse } from '../middleware/pagination';
import { studentSchema } from '../validators/studentValidator';
import { z } from 'zod';
import {
  listStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentClassRoster
} from '../services/studentService';
import { createClassChangeRequest } from '../services/classChangeRequestService';
import { safeAuditLogFromRequest } from '../lib/auditHelpers';
import { createSuccessResponse, createErrorResponse, createPaginatedSuccessResponse } from '../lib/responseHelpers';
import { createGetHandler, createPostHandler, createPutHandler, createDeleteHandler, asyncHandler, requireTenantContext } from '../lib/routeHelpers';
import { mutationRateLimiter } from '../middleware/mutationRateLimiter';

const router = Router();

router.use(authenticate, tenantResolver(), ensureTenantContext());

const listStudentsQuerySchema = z.object({
  classId: z.string().optional(),
  enrollmentStatus: z.string().optional(),
  search: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
  page: z.string().optional()
});

router.get('/', requireAnyPermission('users:manage', 'students:view_own_class'), validateInput(listStudentsQuerySchema, 'query'), asyncHandler(async (req, res) => {
  if (!requireTenantContext(req, res)) return;

  const { classId, enrollmentStatus, search } = req.query;
  const pagination = req.pagination!;
  
  // Pass filters to listStudents service
  const filters = {
    classId: classId as string | undefined,
    enrollmentStatus: enrollmentStatus as string | undefined,
    search: search as string | undefined
  };
  
  const allStudents = await listStudents(req.tenantClient!, req.tenant!.schema, filters) as Array<{
    class_uuid?: string | null;
    class_id?: string | null;
  }>;
  
  // Apply pagination
  const paginated = allStudents.slice(pagination.offset, pagination.offset + pagination.limit);
  const paginationData = createPaginatedResponse(paginated, allStudents.length, pagination);
  const response = createPaginatedSuccessResponse(paginated, paginationData.pagination, 'Students retrieved successfully');
  
  res.json(response);
}));

// Standardized CRUD handlers
router.get('/:id', requirePermission('users:manage'), createGetHandler({
  getResource: getStudent,
  resourceName: 'Student',
  auditAction: 'STUDENT_VIEWED'
}));

router.post('/', requirePermission('users:manage'), validateInput(studentSchema, 'body'), createPostHandler({
  createResource: createStudent,
  resourceName: 'Student',
  auditAction: 'STUDENT_CREATED'
}));

router.put('/:id', requirePermission('users:manage'), mutationRateLimiter, validateInput(studentSchema.partial(), 'body'), createPutHandler({
  updateResource: updateStudent,
  resourceName: 'Student',
  auditAction: 'STUDENT_UPDATED'
}));

router.delete('/:id', requirePermission('users:manage'), mutationRateLimiter, createDeleteHandler({
  deleteResource: deleteStudent,
  resourceName: 'Student',
  auditAction: 'STUDENT_DELETED'
}));

// Student roster endpoint - accessible to students for their own class, or admins/teachers
router.get('/:id/roster', async (req, res, next) => {
  try {
    // Check if user is accessing their own roster or has permission
    const isOwnRoster = req.user?.id === req.params.id;
    const hasPermission =
      req.user?.role === 'admin' || req.user?.role === 'superadmin' || req.user?.role === 'teacher';

    if (!isOwnRoster && !hasPermission) {
      return res.status(403).json(createErrorResponse('You can only view your own class roster'));
    }

    const roster = await getStudentClassRoster(
      req.tenantClient!,
      req.tenant!.schema,
      req.params.id
    );

    if (!roster) {
      return res.status(404).json(createErrorResponse('Student not found or not assigned to a class'));
    }

    res.json(createSuccessResponse(roster, 'Class roster retrieved successfully'));
  } catch (error) {
    next(error);
  }
});

// POST /students/:id/class-change-request - Create a class change request
const classChangeRequestSchema = z.object({
  targetClassId: z.string().min(1, 'Target class ID is required'),
  reason: z.string().optional()
});

router.post('/:id/class-change-request', requirePermission('users:manage'), mutationRateLimiter, validateInput(classChangeRequestSchema, 'body'), async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant || !req.user) {
      return res.status(500).json(createErrorResponse('Tenant context missing'));
    }

    const request = await createClassChangeRequest(
      req.tenantClient,
      req.tenant.schema,
      req.params.id,
      {
        targetClassId: req.body.targetClassId,
        reason: req.body.reason
      },
      req.user.id
    );

    // Audit log
    await safeAuditLogFromRequest(
      req,
      {
        action: 'CLASS_CHANGE_REQUEST_CREATED',
        resourceType: 'student',
        resourceId: req.params.id,
        details: {
          studentId: req.params.id,
          requestedClassId: req.body.targetClassId,
          requestId: request.id
        },
        severity: 'info'
      },
      'students'
    );

    res.status(201).json(createSuccessResponse(request, 'Class change request created successfully'));
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Student not found') {
        return res.status(404).json(createErrorResponse(error.message));
      }
      if (error.message.includes('already in the requested class')) {
        return res.status(400).json(createErrorResponse(error.message));
      }
      if (error.message.includes('pending class change request already exists')) {
        return res.status(409).json(createErrorResponse(error.message));
      }
    }
    next(error);
  }
});

export default router;
