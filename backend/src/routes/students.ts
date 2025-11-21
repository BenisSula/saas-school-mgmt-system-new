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
import { safeAuditLogFromRequest } from '../lib/auditHelpers';

const router = Router();

router.use(authenticate, tenantResolver(), ensureTenantContext());

const listStudentsQuerySchema = z.object({
  classId: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
  page: z.string().optional()
});

router.get('/', requireAnyPermission('users:manage', 'students:view_own_class'), validateInput(listStudentsQuerySchema, 'query'), async (req, res) => {
  const { classId } = req.query;
  const pagination = req.pagination!;
  
  const allStudents = await listStudents(req.tenantClient!, req.tenant!.schema) as Array<{
    class_uuid?: string | null;
    class_id?: string | null;
  }>;
  
  // Filter by class if specified
  let filtered = allStudents;
  if (classId && typeof classId === 'string') {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId);
    if (isUUID) {
      filtered = allStudents.filter((s) => s.class_uuid === classId);
    } else {
      filtered = allStudents.filter((s) => s.class_id === classId);
    }
  }
  
  // Apply pagination
  const paginated = filtered.slice(pagination.offset, pagination.offset + pagination.limit);
  const response = createPaginatedResponse(paginated, filtered.length, pagination);
  
  res.json(response);
});

router.get('/:id', requirePermission('users:manage'), async (req, res, next) => {
  try {
    const student = await getStudent(req.tenantClient!, req.tenant!.schema, req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Audit log for sensitive read operation
    await safeAuditLogFromRequest(
      req,
      {
        action: 'STUDENT_VIEWED',
        resourceType: 'student',
        resourceId: req.params.id,
        details: {
          studentId: req.params.id
        },
        severity: 'info'
      },
      'students'
    );

    res.json(student);
  } catch (error) {
    next(error);
  }
});

router.post('/', requirePermission('users:manage'), validateInput(studentSchema, 'body'), async (req, res, next) => {
  try {
    const student = await createStudent(req.tenantClient!, req.tenant!.schema, req.body, req.user?.id, req.tenant!.id);
    res.status(201).json(student);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requirePermission('users:manage'), validateInput(studentSchema.partial(), 'body'), async (req, res, next) => {
  try {
    const student = await updateStudent(
      req.tenantClient!,
      req.tenant!.schema,
      req.params.id,
      req.body
    );
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Audit log for profile update
    await safeAuditLogFromRequest(
      req,
      {
        action: 'STUDENT_UPDATED',
        resourceType: 'student',
        resourceId: req.params.id,
        details: {
          studentId: req.params.id,
          updatedFields: Object.keys(req.body)
        },
        severity: 'info'
      },
      'students'
    );

    res.json(student);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requirePermission('users:manage'), async (req, res) => {
  await deleteStudent(req.tenantClient!, req.tenant!.schema, req.params.id);
  res.status(204).send();
});

// Student roster endpoint - accessible to students for their own class, or admins/teachers
router.get('/:id/roster', async (req, res, next) => {
  try {
    // Check if user is accessing their own roster or has permission
    const isOwnRoster = req.user?.id === req.params.id;
    const hasPermission =
      req.user?.role === 'admin' || req.user?.role === 'superadmin' || req.user?.role === 'teacher';

    if (!isOwnRoster && !hasPermission) {
      return res.status(403).json({ message: 'You can only view your own class roster' });
    }

    const roster = await getStudentClassRoster(
      req.tenantClient!,
      req.tenant!.schema,
      req.params.id
    );

    if (!roster) {
      return res.status(404).json({ message: 'Student not found or not assigned to a class' });
    }

    res.json(roster);
  } catch (error) {
    next(error);
  }
});

export default router;
