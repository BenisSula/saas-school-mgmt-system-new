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
import verifyTeacherAssignment from '../middleware/verifyTeacherAssignment';
import { createAuditLog } from '../services/audit/enhancedAuditService';

const router = Router();

router.use(
  authenticate,
  tenantResolver(),
  ensureTenantContext()
);
// DEPRECATED: Router-level permission check - individual routes now use requireAnyPermission

const listTeachersQuerySchema = z.object({
  limit: z.string().optional(),
  offset: z.string().optional(),
  page: z.string().optional()
});

router.get('/', validateInput(listTeachersQuerySchema, 'query'), async (req, res) => {
  const pagination = req.pagination!;
  const allTeachers = await listTeachers(req.tenantClient!, req.tenant!.schema);
  
  // Apply pagination
  const paginated = allTeachers.slice(pagination.offset, pagination.offset + pagination.limit);
  const response = createPaginatedResponse(paginated, allTeachers.length, pagination);
  
  res.json(response);
});

router.get('/:id', async (req, res) => {
  const teacher = await getTeacher(req.tenantClient!, req.tenant!.schema, req.params.id);
  if (!teacher) {
    return res.status(404).json({ message: 'Teacher not found' });
  }
  res.json(teacher);
});

router.post('/', validateInput(teacherSchema, 'body'), async (req, res, next) => {
  try {
    const teacher = await createTeacher(req.tenantClient!, req.tenant!.schema, req.body);
    res.status(201).json(teacher);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requirePermission('users:manage'), validateInput(teacherSchema.partial(), 'body'), async (req, res, next) => {
  try {
    const teacher = await updateTeacher(
      req.tenantClient!,
      req.tenant!.schema,
      req.params.id,
      req.body
    );
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    // Create audit log for class assignment if classes were updated
    if (req.body.assigned_classes && req.user && req.tenant) {
      try {
        await createAuditLog(
          req.tenantClient!,
          {
            tenantId: req.tenant.id,
            userId: req.user.id,
            action: 'CLASS_ASSIGNED',
            resourceType: 'teacher',
            resourceId: req.params.id,
            details: {
              teacherId: req.params.id,
              assignedClasses: req.body.assigned_classes,
              assignmentType: 'class_teacher'
            },
            severity: 'info'
          }
        );
      } catch (auditError) {
        console.error('[teachers] Failed to create audit log for class assignment:', auditError);
      }
    }

    res.json(teacher);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requirePermission('users:manage'), async (req, res, next) => {
  try {
    await deleteTeacher(req.tenantClient!, req.tenant!.schema, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Teacher-specific routes (accessible to teachers with students:view_own_class permission)
router.get('/me', requirePermission('dashboard:view'), async (req, res, next) => {
  try {
    if (!req.user || !req.tenantClient || !req.tenant) {
      return res.status(500).json({ message: 'User context missing' });
    }

    const teacherEmail = req.user.email;
    const teacher = await getTeacherByEmail(req.tenantClient, req.tenant.schema, teacherEmail);

    if (!teacher) {
      return res.status(404).json({ message: 'Teacher profile not found' });
    }

    res.json(teacher);
  } catch (error) {
    next(error);
  }
});

router.get('/me/classes', requirePermission('dashboard:view'), async (req, res, next) => {
  try {
    if (!req.user || !req.tenantClient || !req.tenant) {
      return res.status(500).json({ message: 'User context missing' });
    }

    const teacherEmail = req.user.email;
    const teacher = await getTeacherByEmail(req.tenantClient, req.tenant.schema, teacherEmail);

    if (!teacher) {
      return res.status(404).json({ message: 'Teacher profile not found' });
    }

    const assignedClasses = teacher.assigned_classes || [];
    const classes = assignedClasses.map((classId: string) => ({
      id: classId,
      name: classId, // TODO: Query actual class name from classes table
      studentCount: 0 // TODO: Query actual student count
    }));

    res.json(classes);
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
      const response = createPaginatedResponse(paginated, filtered.length, pagination);

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
    const response = createPaginatedResponse(paginated, filtered.length, pagination);

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
