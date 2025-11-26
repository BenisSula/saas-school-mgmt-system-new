import { Router } from 'express';
import type { PoolClient } from 'pg';
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
  deleteTeacher,
} from '../services/teacherService';
import { listStudents } from '../services/studentService';
import { safeAuditLogFromRequest } from '../lib/auditHelpers';
import {
  createSuccessResponse,
  createErrorResponse,
  createPaginatedSuccessResponse,
} from '../lib/responseHelpers';
import { validateContextOrRespond } from '../lib/contextHelpers';
import { mutationRateLimiter } from '../middleware/mutationRateLimiter';
import {
  createGetHandler,
  createPostHandler,
  createDeleteHandler,
  asyncHandler,
} from '../lib/routeHelpers';
import {
  markTeacherAttendance,
  getTeacherAttendance,
  bulkMarkTeacherAttendance,
} from '../services/teacherAttendanceService';
import {
  submitTeacherGrades,
  getTeacherGrades,
  updateTeacherGrade,
} from '../services/teacherGradesService';
import {
  uploadClassResource,
  getClassResources,
  deleteClassResource,
} from '../services/classResourcesService';
import { postClassAnnouncement } from '../services/teacherAnnouncementsService';
import {
  generateAttendancePDF,
  generateAttendanceExcel,
  generateGradesPDF,
  generateGradesExcel,
} from '../services/exportService';
import multer from 'multer';

const router = Router();

router.use(authenticate, tenantResolver(), ensureTenantContext());

const listTeachersQuerySchema = z.object({
  limit: z.string().optional(),
  offset: z.string().optional(),
  page: z.string().optional(),
});

router.get(
  '/',
  validateInput(listTeachersQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const context = validateContextOrRespond(req, res);
    if (!context) return;

    const pagination = req.pagination!;

    // Get total count for pagination (optimized: single COUNT query)
    const countResult = await context.tenantClient.query(
      `SELECT COUNT(*)::int as total FROM ${context.tenant.schema}.teachers`
    );
    const total = countResult.rows[0]?.total || 0;

    // Fetch paginated teachers directly from database (optimized: LIMIT/OFFSET in SQL)
    const teachers = await listTeachers(context.tenantClient, context.tenant.schema, {
      limit: pagination.limit,
      offset: pagination.offset,
    });

    const paginationData = createPaginatedResponse(teachers, total, pagination);
    const response = createPaginatedSuccessResponse(
      teachers,
      paginationData.pagination,
      'Teachers retrieved successfully'
    );

    res.json(response);
  })
);

// Standardized CRUD handlers
router.get(
  '/:id',
  createGetHandler({
    getResource: getTeacher,
    resourceName: 'Teacher',
    auditAction: 'TEACHER_VIEWED',
  })
);

router.post(
  '/',
  mutationRateLimiter,
  validateInput(teacherSchema, 'body'),
  createPostHandler({
    createResource: createTeacher,
    resourceName: 'Teacher',
    auditAction: 'TEACHER_CREATED',
  })
);

router.put(
  '/:id',
  requirePermission('users:manage'),
  mutationRateLimiter,
  validateInput(teacherSchema.partial(), 'body'),
  asyncHandler(async (req, res, next) => {
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
              assignmentType: 'class_teacher',
            },
            severity: 'info',
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
              assignmentType: 'subject_teacher',
            },
            severity: 'info',
          },
          'teachers'
        );
      }

      // Audit log for general profile update
      const updatedFields = Object.keys(req.body).filter(
        (key) => key !== 'assigned_classes' && key !== 'assignedClasses' && key !== 'subjects'
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
              updatedFields: updatedFields,
            },
            severity: 'info',
          },
          'teachers'
        );
      }

      res.json(createSuccessResponse(teacher, 'Teacher updated successfully'));
      return;
    } catch (error) {
      next(error);
      return;
    }
  })
);

router.delete(
  '/:id',
  requirePermission('users:manage'),
  mutationRateLimiter,
  createDeleteHandler({
    deleteResource: deleteTeacher,
    resourceName: 'Teacher',
    auditAction: 'TEACHER_DELETED',
  })
);

// Teacher-specific routes (accessible to teachers with students:view_own_class permission)
router.get('/me', requirePermission('dashboard:view'), async (req, res, next) => {
  try {
    const context = validateContextOrRespond(req, res);
    if (!context) return;
    const { tenant, tenantClient, user } = context;

    const teacherEmail = user.email;
    const teacher = await getTeacherByEmail(tenantClient, tenant.schema, teacherEmail);

    if (!teacher) {
      return res.status(404).json(createErrorResponse('Teacher profile not found'));
    }

    res.json(createSuccessResponse(teacher, 'Teacher profile retrieved successfully'));
    return;
  } catch (error) {
    next(error);
    return;
  }
});

router.get('/me/classes', requirePermission('dashboard:view'), async (req, res, next) => {
  try {
    const context = validateContextOrRespond(req, res);
    if (!context) return;
    const { tenant, tenantClient, user } = context;

    const teacherEmail = user.email;
    const teacher = await getTeacherByEmail(tenantClient, tenant.schema, teacherEmail);

    if (!teacher) {
      return res.status(404).json(createErrorResponse('Teacher profile not found'));
    }

    const assignedClasses = teacher.assigned_classes || [];
    if (assignedClasses.length === 0) {
      return res.json(createSuccessResponse([], 'No classes assigned'));
    }

    // Use extracted variables from context check
    const schema = tenant.schema;
    const client = tenantClient;

    // Query classes table to get class names
    // Handle both UUID and text class IDs
    const isUUID = (id: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

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
    const allStudents = (await listStudents(client, schema)) as Array<{
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
      studentCount: studentCounts.get(classId) || 0,
    }));

    res.json(createSuccessResponse(classes, 'Teacher classes retrieved successfully'));
    return;
  } catch (error) {
    next(error);
    return;
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
      const allStudents = (await listStudents(req.tenantClient, req.tenant.schema)) as Array<{
        class_uuid?: string | null;
        class_id?: string | null;
      }>;

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        classId
      );
      const filtered = allStudents.filter((s) => {
        if (isUUID) {
          return s.class_uuid === classId;
        } else {
          return s.class_id === classId;
        }
      });

      const paginated = filtered.slice(pagination.offset, pagination.offset + pagination.limit);
      const paginationData = createPaginatedResponse(paginated, filtered.length, pagination);
      const response = createPaginatedSuccessResponse(
        paginated,
        paginationData.pagination,
        'Students retrieved successfully'
      );

      return res.json(response);
    }
    // Get students from all assigned classes
    const allStudents = (await listStudents(req.tenantClient, req.tenant.schema)) as Array<{
      class_uuid?: string | null;
      class_id?: string | null;
    }>;

    const filtered = allStudents.filter((s) => {
      return assignedClasses.some((classId: string) => {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          classId
        );
        if (isUUID) {
          return s.class_uuid === classId;
        } else {
          return s.class_id === classId;
        }
      });
    });

    const paginated = filtered.slice(pagination.offset, pagination.offset + pagination.limit);
    const paginationData = createPaginatedResponse(paginated, filtered.length, pagination);
    const response = createPaginatedSuccessResponse(
      paginated,
      paginationData.pagination,
      'Students retrieved successfully'
    );

    res.json(response);
      return;
  } catch (error) {
    next(error);
      return;
  }
});

// Helper function to get teacher ID from user
async function getTeacherIdFromUser(
  tenantClient: PoolClient,
  schema: string,
  userEmail: string
): Promise<string | null> {
  const teacher = await getTeacherByEmail(tenantClient, schema, userEmail);
  return teacher?.id || null;
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ========== TEACHER ATTENDANCE ROUTES ==========

/**
 * POST /teachers/attendance/mark
 * Mark attendance for a class
 */
router.post('/attendance/mark', requirePermission('attendance:mark'), async (req, res, next) => {
  try {
    const context = validateContextOrRespond(req, res);
    if (!context) return;
    const { tenant, tenantClient, user } = context;

    const teacherId = await getTeacherIdFromUser(tenantClient, tenant.schema, user.email);
    if (!teacherId) {
      return res.status(404).json(createErrorResponse('Teacher profile not found'));
    }

    const records = req.body.records as Array<{
      studentId: string;
      classId: string;
      status: 'present' | 'absent' | 'late';
      date: string;
    }>;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json(createErrorResponse('records array is required'));
    }

    await markTeacherAttendance(
      tenantClient,
      tenant.schema,
      teacherId,
      records.map((r) => ({ ...r, markedBy: user.id })),
      user.id
    );

    res.status(200).json(createSuccessResponse(null, 'Attendance marked successfully'));
    return;
  } catch (error) {
    next(error);
    return;
  }
});

/**
 * GET /teachers/attendance
 * Get attendance records
 */
router.get(
  '/attendance',
  requirePermission('attendance:view_own_class'),
  async (req, res, next) => {
    try {
      const context = validateContextOrRespond(req, res);
      if (!context) return;
      const { tenant, tenantClient, user } = context;

      const teacherId = await getTeacherIdFromUser(tenantClient, tenant.schema, user.email);
      if (!teacherId) {
        return res.status(404).json(createErrorResponse('Teacher profile not found'));
      }

      const attendance = await getTeacherAttendance(tenantClient, tenant.schema, teacherId, {
        classId: req.query.classId as string | undefined,
        date: req.query.date as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
      });

      res.json(createSuccessResponse(attendance, 'Attendance retrieved successfully'));
      return;
    } catch (error) {
      next(error);
      return;
    }
  }
);

/**
 * POST /teachers/attendance/bulk
 * Bulk mark attendance
 */
router.post('/attendance/bulk', requirePermission('attendance:mark'), async (req, res, next) => {
  try {
    const context = validateContextOrRespond(req, res);
    if (!context) return;
    const { tenant, tenantClient, user } = context;

    const teacherId = await getTeacherIdFromUser(tenantClient, tenant.schema, user.email);
    if (!teacherId) {
      return res.status(404).json(createErrorResponse('Teacher profile not found'));
    }

    const records = req.body.records as Array<{
      studentId: string;
      classId: string;
      status: 'present' | 'absent' | 'late';
      date: string;
    }>;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json(createErrorResponse('records array is required'));
    }

    await bulkMarkTeacherAttendance(
      tenantClient,
      tenant.schema,
      teacherId,
      records.map((r) => ({ ...r, markedBy: user.id })),
      user.id
    );

    res.status(200).json(createSuccessResponse(null, 'Attendance marked successfully'));
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// ========== TEACHER GRADES ROUTES ==========

/**
 * POST /teachers/grades/submit
 * Submit grades for students
 */
router.post('/grades/submit', requirePermission('grades:enter'), async (req, res, next) => {
  try {
    const context = validateContextOrRespond(req, res);
    if (!context) return;
    const { tenant, tenantClient, user } = context;

    const teacherId = await getTeacherIdFromUser(tenantClient, tenant.schema, user.email);
    if (!teacherId) {
      return res.status(404).json(createErrorResponse('Teacher profile not found'));
    }

    const grades = req.body.grades as Array<{
      studentId: string;
      classId: string;
      subjectId?: string;
      examId?: string;
      score: number;
      remarks?: string;
      term?: string;
    }>;

    if (!Array.isArray(grades) || grades.length === 0) {
      return res.status(400).json(createErrorResponse('grades array is required'));
    }

    const result = await submitTeacherGrades(
      tenantClient,
      tenant.schema,
      teacherId,
      grades,
      user.id
    );

    res.status(200).json(createSuccessResponse(result, 'Grades submitted successfully'));
    return;
  } catch (error) {
    next(error);
    return;
  }
});

/**
 * PUT /teachers/grades/:gradeId
 * Update a specific grade
 */
router.put('/grades/:gradeId', requirePermission('grades:edit'), async (req, res, next) => {
  try {
    const context = validateContextOrRespond(req, res);
    if (!context) return;
    const { tenant, tenantClient, user } = context;

    const teacherId = await getTeacherIdFromUser(tenantClient, tenant.schema, user.email);
    if (!teacherId) {
      return res.status(404).json(createErrorResponse('Teacher profile not found'));
    }

    const result = await updateTeacherGrade(
      tenantClient,
      tenant.schema,
      teacherId,
      req.params.gradeId,
      {
        score: req.body.score,
        remarks: req.body.remarks,
      },
      user.id
    );

    if (!result) {
      return res.status(404).json(createErrorResponse('Grade not found'));
    }

    res.json(createSuccessResponse(result, 'Grade updated successfully'));
    return;
  } catch (error) {
    next(error);
    return;
  }
});

/**
 * GET /teachers/grades
 * Get grades for a class/subject
 */
router.get('/grades', requirePermission('grades:view_own_class'), async (req, res, next) => {
  try {
    const context = validateContextOrRespond(req, res);
    if (!context) return;
    const { tenant, tenantClient, user } = context;

    const teacherId = await getTeacherIdFromUser(tenantClient, tenant.schema, user.email);
    if (!teacherId) {
      return res.status(404).json(createErrorResponse('Teacher profile not found'));
    }

    const grades = await getTeacherGrades(tenantClient, tenant.schema, teacherId, {
      classId: req.query.classId as string | undefined,
      subjectId: req.query.subjectId as string | undefined,
      examId: req.query.examId as string | undefined,
      term: req.query.term as string | undefined,
    });

    res.json(createSuccessResponse(grades, 'Grades retrieved successfully'));
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// ========== CLASS RESOURCES ROUTES ==========

/**
 * POST /teachers/resources/upload
 * Upload a class resource
 */
router.post(
  '/resources/upload',
  requirePermission('resources:upload'),
  upload.single('file'),
  async (req, res, next) => {
    try {
      const context = validateContextOrRespond(req, res);
      if (!context) return;
      const { tenant, tenantClient, user } = context;

      const teacherId = await getTeacherIdFromUser(tenantClient, tenant.schema, user.email);
      if (!teacherId) {
        return res.status(404).json(createErrorResponse('Teacher profile not found'));
      }

      if (!req.file) {
        return res.status(400).json(createErrorResponse('File is required'));
      }

      const resource = await uploadClassResource(
        tenantClient,
        tenant.schema,
        tenant.id,
        teacherId,
        {
          classId: req.body.classId,
          title: req.body.title,
          description: req.body.description,
          file: {
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            data: req.file.buffer,
          },
        },
        user.id
      );

    res.status(201).json(createSuccessResponse(resource, 'Resource uploaded successfully'));
    return;
  } catch (error) {
    next(error);
    return;
  }
  }
);

/**
 * GET /teachers/resources
 * Get class resources
 */
router.get('/resources', requirePermission('resources:upload'), async (req, res, next) => {
  try {
    const context = validateContextOrRespond(req, res);
    if (!context) return;
    const { tenant, tenantClient, user } = context;

    const classId = req.query.classId as string;
    if (!classId) {
      return res.status(400).json(createErrorResponse('classId is required'));
    }

    const teacherId = await getTeacherIdFromUser(tenantClient, tenant.schema, user.email);
    if (!teacherId) {
      return res.status(404).json(createErrorResponse('Teacher profile not found'));
    }

    const resources = await getClassResources(tenantClient, tenant.schema, classId, teacherId);

    res.json(createSuccessResponse(resources, 'Resources retrieved successfully'));
    return;
  } catch (error) {
    next(error);
    return;
  }
});

/**
 * DELETE /teachers/resources/:resourceId
 * Delete a class resource
 */
router.delete(
  '/resources/:resourceId',
  requirePermission('resources:upload'),
  async (req, res, next) => {
    try {
      const context = validateContextOrRespond(req, res);
      if (!context) return;
      const { tenant, tenantClient, user } = context;

      const teacherId = await getTeacherIdFromUser(tenantClient, tenant.schema, user.email);
      if (!teacherId) {
        return res.status(404).json(createErrorResponse('Teacher profile not found'));
      }

      const deleted = await deleteClassResource(
        tenantClient,
        tenant.schema,
        teacherId,
        req.params.resourceId,
        user.id
      );

      if (!deleted) {
        return res.status(404).json(createErrorResponse('Resource not found'));
      }

      res.json(createSuccessResponse(null, 'Resource deleted successfully'));
      return;
    } catch (error) {
      next(error);
      return;
    }
  }
);

// ========== TEACHER ANNOUNCEMENTS ROUTES ==========

/**
 * POST /teachers/announcements
 * Post an announcement to a class
 */
router.post('/announcements', requirePermission('announcements:post'), async (req, res, next) => {
  try {
    const context = validateContextOrRespond(req, res);
    if (!context) return;
    const { tenant, tenantClient, user } = context;

    const teacherId = await getTeacherIdFromUser(tenantClient, tenant.schema, user.email);
    if (!teacherId) {
      return res.status(404).json(createErrorResponse('Teacher profile not found'));
    }

    const announcement = await postClassAnnouncement(
      tenantClient,
      tenant.schema,
      tenant.id,
      teacherId,
      {
        classId: req.body.classId,
        message: req.body.message,
        attachments: req.body.attachments,
      },
      user.id
    );

    res.status(201).json(createSuccessResponse(announcement, 'Announcement posted successfully'));
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// ========== EXPORT ROUTES ==========

/**
 * GET /teachers/export/attendance
 * Export attendance as PDF or Excel
 */
router.get(
  '/export/attendance',
  requirePermission('attendance:view_own_class'),
  async (req, res, next) => {
    try {
      const context = validateContextOrRespond(req, res);
      if (!context) return;
      const { tenant, tenantClient, user } = context;

      const teacherId = await getTeacherIdFromUser(tenantClient, tenant.schema, user.email);
      if (!teacherId) {
        return res.status(404).json(createErrorResponse('Teacher profile not found'));
      }

      const classId = req.query.classId as string;
      if (!classId) {
        return res.status(400).json(createErrorResponse('classId is required'));
      }

      const format = (req.query.format as string) || 'pdf';
      const options = {
        classId,
        date: req.query.date as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
      };

      let buffer: Buffer;
      let contentType: string;
      let filename: string;

      if (format === 'excel' || format === 'xlsx') {
        buffer = await generateAttendanceExcel(tenantClient, tenant.schema, teacherId, options);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        filename = `attendance_${classId}_${new Date().toISOString().split('T')[0]}.xlsx`;
      } else {
        buffer = await generateAttendancePDF(tenantClient, tenant.schema, teacherId, options);
        contentType = 'application/pdf';
        filename = `attendance_${classId}_${new Date().toISOString().split('T')[0]}.pdf`;
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
      return;
    } catch (error) {
      next(error);
      return;
    }
  }
);

/**
 * GET /teachers/export/grades
 * Export grades as PDF or Excel
 */
router.get('/export/grades', requirePermission('grades:view_own_class'), async (req, res, next) => {
  try {
    const context = validateContextOrRespond(req, res);
    if (!context) return;
    const { tenant, tenantClient, user } = context;

    const teacherId = await getTeacherIdFromUser(tenantClient, tenant.schema, user.email);
    if (!teacherId) {
      return res.status(404).json(createErrorResponse('Teacher profile not found'));
    }

    const classId = req.query.classId as string;
    if (!classId) {
      return res.status(400).json(createErrorResponse('classId is required'));
    }

    const format = (req.query.format as string) || 'pdf';
    const options = {
      classId,
      subjectId: req.query.subjectId as string | undefined,
      examId: req.query.examId as string | undefined,
      term: req.query.term as string | undefined,
    };

    let buffer: Buffer;
    let contentType: string;
    let filename: string;

    if (format === 'excel' || format === 'xlsx') {
      buffer = await generateGradesExcel(tenantClient, tenant.schema, teacherId, options);
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      filename = `grades_${classId}_${new Date().toISOString().split('T')[0]}.xlsx`;
    } else {
      buffer = await generateGradesPDF(tenantClient, tenant.schema, teacherId, options);
      contentType = 'application/pdf';
      filename = `grades_${classId}_${new Date().toISOString().split('T')[0]}.pdf`;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
      return;
  } catch (error) {
    next(error);
      return;
  }
});

export default router;
