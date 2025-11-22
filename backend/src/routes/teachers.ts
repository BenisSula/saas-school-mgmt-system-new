import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import ensureTenantContext from '../middleware/ensureTenantContext';
import { requirePermission } from '../middleware/rbac';
import { validateInput } from '../middleware/validateInput';
import { createPaginatedResponse } from '../middleware/pagination';
import { teacherSchema } from '../validators/teacherValidator';
import { z } from 'zod';
import {
  listTeachers,
  getTeacher,
  getTeacherByEmail,
  createTeacher,
  updateTeacher,
  deleteTeacher
} from '../services/teacherService';
import { listStudents } from '../services/studentService';
import { safeAuditLogFromRequest } from '../lib/auditHelpers';
import { createSuccessResponse, createErrorResponse, createPaginatedSuccessResponse } from '../lib/responseHelpers';
import { mutationRateLimiter } from '../middleware/mutationRateLimiter';
import { createGetHandler, createPostHandler, createDeleteHandler, asyncHandler, requireTenantContext } from '../lib/routeHelpers';

const router = Router();

router.use(
  authenticate,
  tenantResolver(),
  ensureTenantContext()
);

const listTeachersQuerySchema = z.object({
  limit: z.string().optional(),
  offset: z.string().optional(),
  page: z.string().optional()
});

router.get('/', validateInput(listTeachersQuerySchema, 'query'), asyncHandler(async (req, res) => {
  if (!requireTenantContext(req, res)) return;

  const pagination = req.pagination!;
  const allTeachers = await listTeachers(req.tenantClient!, req.tenant!.schema);
  
  // Apply pagination
  const paginated = allTeachers.slice(pagination.offset, pagination.offset + pagination.limit);
  const paginationData = createPaginatedResponse(paginated, allTeachers.length, pagination);
  const response = createPaginatedSuccessResponse(paginated, paginationData.pagination, 'Teachers retrieved successfully');
  
  res.json(response);
}));

// Standardized CRUD handlers
router.get('/:id', createGetHandler({
  getResource: getTeacher,
  resourceName: 'Teacher',
  auditAction: 'TEACHER_VIEWED'
}));

router.post('/', mutationRateLimiter, validateInput(teacherSchema, 'body'), createPostHandler({
  createResource: createTeacher,
  resourceName: 'Teacher',
  auditAction: 'TEACHER_CREATED'
}));

router.put('/:id', requirePermission('users:manage'), mutationRateLimiter, validateInput(teacherSchema.partial(), 'body'), asyncHandler(async (req, res, next) => {
  try {
    const teacher = await updateTeacher(
      req.tenantClient!,
      req.tenant!.schema,
      req.params.id,
      req.body
    );
    if (!teacher) {
      return res.status(404).json(createErrorResponse('Teacher not found'));
    }

    // Create audit log for class assignment if classes were updated
    if (req.body.assigned_classes || req.body.assignedClasses) {
      const assignedClasses = req.body.assigned_classes || req.body.assignedClasses;
      await safeAuditLogFromRequest(
        req,
        {
          action: 'CLASS_ASSIGNED',
          resourceType: 'teacher',
          resourceId: req.params.id,
          details: {
            teacherId: req.params.id,
            assignedClasses: assignedClasses,
            assignmentType: 'class_teacher'
          },
          severity: 'info'
        },
        'teachers'
      );
    }

    // Create audit log for subject assignment if subjects were updated
    if (req.body.subjects) {
      await safeAuditLogFromRequest(
        req,
        {
          action: 'SUBJECT_ASSIGNED',
          resourceType: 'teacher',
          resourceId: req.params.id,
          details: {
            teacherId: req.params.id,
            assignedSubjects: req.body.subjects,
            assignmentType: 'subject_teacher'
          },
          severity: 'info'
        },
        'teachers'
      );
    }

    // Audit log for general profile update
    const updatedFields = Object.keys(req.body).filter(key => 
      key !== 'assigned_classes' && key !== 'assignedClasses' && key !== 'subjects'
    );
    if (updatedFields.length > 0) {
      await safeAuditLogFromRequest(
        req,
        {
          action: 'TEACHER_UPDATED',
          resourceType: 'teacher',
          resourceId: req.params.id,
          details: {
            teacherId: req.params.id,
            updatedFields: updatedFields
          },
          severity: 'info'
        },
        'teachers'
      );
    }

    res.json(createSuccessResponse(teacher, 'Teacher updated successfully'));
  } catch (error) {
    next(error);
  }
}));

router.delete('/:id', requirePermission('users:manage'), mutationRateLimiter, createDeleteHandler({
  deleteResource: deleteTeacher,
  resourceName: 'Teacher',
  auditAction: 'TEACHER_DELETED'
}));

// Teacher-specific routes (accessible to teachers with students:view_own_class permission)
router.get('/me', requirePermission('dashboard:view'), async (req, res, next) => {
  try {
    if (!req.user || !req.tenantClient || !req.tenant) {
      return res.status(500).json(createErrorResponse('User context missing'));
    }

    const teacherEmail = req.user.email;
    const teacher = await getTeacherByEmail(req.tenantClient, req.tenant.schema, teacherEmail);

    if (!teacher) {
      return res.status(404).json(createErrorResponse('Teacher profile not found'));
    }

    res.json(createSuccessResponse(teacher, 'Teacher profile retrieved successfully'));
  } catch (error) {
    next(error);
  }
});

router.get('/me/classes', requirePermission('dashboard:view'), async (req, res, next) => {
  try {
    if (!req.user || !req.tenantClient || !req.tenant) {
      return res.status(500).json(createErrorResponse('User context missing'));
    }

    const teacherEmail = req.user.email;
    const teacher = await getTeacherByEmail(req.tenantClient, req.tenant.schema, teacherEmail);

    if (!teacher) {
      return res.status(404).json(createErrorResponse('Teacher profile not found'));
    }

    const assignedClasses = teacher.assigned_classes || [];
    if (assignedClasses.length === 0) {
      return res.json(createSuccessResponse([], 'No classes assigned'));
    }

    const schema = req.tenant.schema;
    const client = req.tenantClient;

    // Query classes table to get class names
    // Handle both UUID and text class IDs
    const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    const classIds = assignedClasses.filter((id: string) => isUUID(id));
    const classNameIds = assignedClasses.filter((id: string) => !isUUID(id));

    // Query classes by UUID
    let classMap = new Map<string, string>();
    if (classIds.length > 0) {
      const placeholders = classIds.map((_: string, i: number) => `$${i + 1}`).join(',');
      const classResult = await client.query(
        `SELECT id::text, name FROM ${schema}.classes WHERE id::text IN (${placeholders})`,
        classIds
      );
      classResult.rows.forEach((row: { id: string; name: string }) => {
        classMap.set(row.id, row.name);
      });
    }

    // Query classes by name (text ID)
    if (classNameIds.length > 0) {
      const placeholders = classNameIds.map((_: string, i: number) => `$${i + 1}`).join(',');
      const classResult = await client.query(
        `SELECT name, name as id FROM ${schema}.classes WHERE name IN (${placeholders})`,
        classNameIds
      );
      classResult.rows.forEach((row: { id: string; name: string }) => {
        classMap.set(row.id, row.name);
      });
    }

    // Query student counts per class
    const studentCounts = new Map<string, number>();
    const allStudents = await listStudents(client, schema) as Array<{
      class_uuid?: string | null;
      class_id?: string | null;
    }>;

    assignedClasses.forEach((classId: string) => {
      const count = allStudents.filter((s) => {
        if (isUUID(classId)) {
          return s.class_uuid === classId;
        } else {
          return s.class_id === classId;
        }
      }).length;
      studentCounts.set(classId, count);
    });

    // Build response with actual class names and student counts
    const classes = assignedClasses.map((classId: string) => ({
      id: classId,
      name: classMap.get(classId) || classId, // Fallback to classId if not found in classes table
      studentCount: studentCounts.get(classId) || 0
    }));

    res.json(createSuccessResponse(classes, 'Teacher classes retrieved successfully'));
  } catch (error) {
    next(error);
  }
});

router.get('/me/students', requirePermission('students:view_own_class'), async (req, res, next) => {
  try {
    if (!req.user || !req.tenantClient || !req.tenant) {
      return res.status(500).json({ message: 'User context missing' });
    }

    const { classId } = req.query;
    const pagination = req.pagination!;

    const teacherEmail = req.user.email;
    const teacher = await getTeacherByEmail(req.tenantClient, req.tenant.schema, teacherEmail);

    if (!teacher) {
      return res.status(404).json({ message: 'Teacher profile not found' });
    }

    const assignedClasses = teacher.assigned_classes || [];

    if (classId && typeof classId === 'string') {
      // Verify teacher is assigned to this class
      if (!assignedClasses.includes(classId)) {
        return res.status(403).json({ message: 'You are not assigned to this class' });
      }

      // Get students for this specific class
      const allStudents = await listStudents(req.tenantClient, req.tenant.schema) as Array<{
        class_uuid?: string | null;
        class_id?: string | null;
      }>;

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId);
      const filtered = allStudents.filter((s) => {
        if (isUUID) {
          return s.class_uuid === classId;
        } else {
          return s.class_id === classId;
        }
      });

      const paginated = filtered.slice(pagination.offset, pagination.offset + pagination.limit);
      const paginationData = createPaginatedResponse(paginated, filtered.length, pagination);
      const response = createPaginatedSuccessResponse(paginated, paginationData.pagination, 'Students retrieved successfully');

      return res.json(response);
    }

    // Get students from all assigned classes
    const allStudents = await listStudents(req.tenantClient, req.tenant.schema) as Array<{
      class_uuid?: string | null;
      class_id?: string | null;
    }>;

    const filtered = allStudents.filter((s) => {
      return assignedClasses.some((classId: string) => {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId);
        if (isUUID) {
          return s.class_uuid === classId;
        } else {
          return s.class_id === classId;
        }
      });
    });

    const paginated = filtered.slice(pagination.offset, pagination.offset + pagination.limit);
    const paginationData = createPaginatedResponse(paginated, filtered.length, pagination);
    const response = createPaginatedSuccessResponse(paginated, paginationData.pagination, 'Students retrieved successfully');

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
