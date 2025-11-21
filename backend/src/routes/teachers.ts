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
import { safeAuditLogFromRequest } from '../lib/auditHelpers';

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

router.get('/', validateInput(listTeachersQuerySchema, 'query'), async (req, res) => {
  const pagination = req.pagination!;
  const allTeachers = await listTeachers(req.tenantClient!, req.tenant!.schema);
  
  // Apply pagination
  const paginated = allTeachers.slice(pagination.offset, pagination.offset + pagination.limit);
  const response = createPaginatedResponse(paginated, allTeachers.length, pagination);
  
  res.json(response);
});

router.get('/:id', async (req, res, next) => {
  try {
    const teacher = await getTeacher(req.tenantClient!, req.tenant!.schema, req.params.id);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    // Audit log for sensitive read operation
    await safeAuditLogFromRequest(
      req,
      {
        action: 'TEACHER_VIEWED',
        resourceType: 'teacher',
        resourceId: req.params.id,
        details: {
          teacherId: req.params.id
        },
        severity: 'info'
      },
      'teachers'
    );

    res.json(teacher);
  } catch (error) {
    next(error);
  }
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
    if (req.body.assigned_classes) {
      await safeAuditLogFromRequest(
        req,
        {
          action: 'CLASS_ASSIGNED',
          resourceType: 'teacher',
          resourceId: req.params.id,
          details: {
            teacherId: req.params.id,
            assignedClasses: req.body.assigned_classes,
            assignmentType: 'class_teacher'
          },
          severity: 'info'
        },
        'teachers'
      );
    }

    // Audit log for general profile update
    const updatedFields = Object.keys(req.body).filter(key => key !== 'assigned_classes');
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
    if (assignedClasses.length === 0) {
      return res.json([]);
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
