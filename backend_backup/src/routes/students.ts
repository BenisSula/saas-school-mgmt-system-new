/**
 * Student Routes
 * Handles student-specific endpoints
 */

import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import ensureTenantContext from '../middleware/ensureTenantContext';
import { requirePermission } from '../middleware/rbac';
import { validateContextOrRespond } from '../lib/contextHelpers';
import { createSuccessResponse, createErrorResponse } from '../lib/responseHelpers';
import { getStudentDashboard } from '../services/studentDashboardService';
import { getClassResources } from '../services/classResourcesService';
import { getClassAnnouncements } from '../services/teacherAnnouncementsService';
import { getStudentAttendance, getAttendanceSummary } from '../services/attendanceService';
import { createAuditLog } from '../services/audit/enhancedAuditService';
import { listStudents } from '../services/studentService';
import { createPaginatedResponse } from '../middleware/pagination';

const router = Router();

router.use(authenticate, tenantResolver(), ensureTenantContext());

/**
 * GET /students
 * List all students (admin/teacher access)
 * Supports filtering by classId, enrollmentStatus, and search
 * Admins have 'students:manage' permission
 */
router.get('/', requirePermission('students:manage'), async (req, res, next) => {
  try {
    if (!req.tenant || !req.tenantClient) {
      return res.status(500).json(createErrorResponse('Tenant context missing'));
    }

    const pagination = req.pagination!;
    const { classId, enrollmentStatus, search } = req.query;

    const filters: {
      classId?: string;
      enrollmentStatus?: string;
      search?: string;
    } = {};

    if (classId && typeof classId === 'string') {
      filters.classId = classId;
    }
    if (enrollmentStatus && typeof enrollmentStatus === 'string') {
      filters.enrollmentStatus = enrollmentStatus;
    }
    if (search && typeof search === 'string') {
      filters.search = search;
    }

    const allStudents = await listStudents(req.tenantClient, req.tenant.schema, filters);

    // Apply pagination
    const paginated = allStudents.slice(pagination.offset, pagination.offset + pagination.limit);
    const response = createPaginatedResponse(paginated, allStudents.length, pagination);

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /students/me/dashboard
 * Get student dashboard data
 */
router.get('/me/dashboard', requirePermission('dashboard:view'), async (req, res, next) => {
  try {
    const context = validateContextOrRespond(req, res);
    if (!context) return;
    const { tenant, tenantClient, user } = context;

    // Get student's class
    const studentResult = await tenantClient.query<{ id: string; class_id: string | null; class_uuid: string | null }>(
      `SELECT id, class_id, class_uuid FROM ${tenant.schema}.students WHERE id = $1 OR email = $2 LIMIT 1`,
      [user.id, user.email]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Student profile not found'));
    }

    const student = studentResult.rows[0];
    const classId = student.class_uuid || student.class_id;

    if (!classId) {
      return res.status(400).json(createErrorResponse('Student is not assigned to a class'));
    }

    const dashboard = await getStudentDashboard(tenantClient, tenant.schema, student.id, classId);

    // Create audit log
    try {
      await createAuditLog(tenantClient, {
        tenantId: tenant.id,
        userId: user.id,
        action: 'STUDENT_VIEWED_DASHBOARD',
        resourceType: 'dashboard',
        resourceId: undefined,
        details: {
          studentId: student.id,
          classId
        },
        severity: 'info'
      });
    } catch (auditError) {
      console.error('[students route] Failed to create audit log:', auditError);
    }

    res.json(createSuccessResponse(dashboard, 'Dashboard data retrieved successfully'));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /students/announcements
 * Get announcements for student's class
 */
router.get('/announcements', requirePermission('messages:receive'), async (req, res, next) => {
  try {
    const context = validateContextOrRespond(req, res);
    if (!context) return;
    const { tenant, tenantClient, user } = context;

    const classId = req.query.classId as string;
    if (!classId) {
      return res.status(400).json(createErrorResponse('classId is required'));
    }

    // Verify student belongs to class
    const studentCheck = await tenantClient.query<{ class_id: string | null; class_uuid: string | null }>(
      `SELECT class_id, class_uuid FROM ${tenant.schema}.students WHERE id = $1 OR email = $2 LIMIT 1`,
      [user.id, user.email]
    );

    if (studentCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Student profile not found'));
    }

    const student = studentCheck.rows[0];
    const isInClass = student.class_id === classId || student.class_uuid === classId;

    if (!isInClass) {
      return res.status(403).json(createErrorResponse('You do not belong to this class'));
    }

    const announcements = await getClassAnnouncements(tenantClient, tenant.schema, classId);

    res.json(createSuccessResponse(announcements, 'Announcements retrieved successfully'));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /students/resources
 * Get resources for student's class
 */
router.get('/resources', requirePermission('dashboard:view'), async (req, res, next) => {
  try {
    const context = validateContextOrRespond(req, res);
    if (!context) return;
    const { tenant, tenantClient, user } = context;

    const classId = req.query.classId as string;
    if (!classId) {
      return res.status(400).json(createErrorResponse('classId is required'));
    }

    // Verify student belongs to class
    const studentCheck = await tenantClient.query<{ id: string; class_id: string | null; class_uuid: string | null }>(
      `SELECT id, class_id, class_uuid FROM ${tenant.schema}.students WHERE id = $1 OR email = $2 LIMIT 1`,
      [user.id, user.email]
    );

    if (studentCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Student profile not found'));
    }

    const student = studentCheck.rows[0];
    const isInClass = student.class_id === classId || student.class_uuid === classId;

    if (!isInClass) {
      return res.status(403).json(createErrorResponse('You do not belong to this class'));
    }

    const resources = await getClassResources(tenantClient, tenant.schema, classId);

    // Create audit log for resource view
    try {
      await createAuditLog(tenantClient, {
        tenantId: tenant.id,
        userId: user.id,
        action: 'STUDENT_VIEWED_RESOURCE',
        resourceType: 'resource',
        resourceId: undefined,
        details: {
          studentId: student.id,
          classId
        },
        severity: 'info'
      });
    } catch (auditError) {
      console.error('[students route] Failed to create audit log:', auditError);
    }

    res.json(createSuccessResponse(resources, 'Resources retrieved successfully'));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /students/attendance
 * Get student's attendance
 */
router.get('/attendance', requirePermission('attendance:view'), async (req, res, next) => {
  try {
    const context = validateContextOrRespond(req, res);
    if (!context) return;
    const { tenant, tenantClient, user } = context;

    // Get student ID
    const studentResult = await tenantClient.query<{ id: string }>(
      `SELECT id FROM ${tenant.schema}.students WHERE id = $1 OR email = $2 LIMIT 1`,
      [user.id, user.email]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Student profile not found'));
    }

    const studentId = studentResult.rows[0].id;

    const history = await getStudentAttendance(
      tenantClient,
      tenant.schema,
      studentId,
      req.query.from as string | undefined,
      req.query.to as string | undefined
    );

    const summary = await getAttendanceSummary(tenantClient, tenant.schema, studentId);

    res.json(createSuccessResponse({ history, summary }, 'Attendance retrieved successfully'));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /students/grades
 * Get student's grades
 */
router.get('/grades', requirePermission('exams:view'), async (req, res, next) => {
  try {
    const context = validateContextOrRespond(req, res);
    if (!context) return;
    const { tenant, tenantClient, user } = context;

    // Get student ID
    const studentResult = await tenantClient.query<{ id: string }>(
      `SELECT id FROM ${tenant.schema}.students WHERE id = $1 OR email = $2 LIMIT 1`,
      [user.id, user.email]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Student profile not found'));
    }

    const studentId = studentResult.rows[0].id;

    const params: unknown[] = [studentId];
    let query = `
      SELECT 
        g.*,
        s.name as subject_name,
        e.name as exam_name,
        c.name as class_name
      FROM ${tenant.schema}.grades g
      LEFT JOIN ${tenant.schema}.subjects s ON g.subject_id = s.id
      LEFT JOIN ${tenant.schema}.exams e ON g.exam_id = e.id
      LEFT JOIN ${tenant.schema}.classes c ON g.class_id = c.id::text OR g.class_id = c.name
      WHERE g.student_id = $1
    `;

    if (req.query.term) {
      params.push(req.query.term);
      query += ` AND g.term = $${params.length}`;
    }

    query += ` ORDER BY g.created_at DESC`;

    const gradesResult = await tenantClient.query(query, params);

    res.json(createSuccessResponse(gradesResult.rows, 'Grades retrieved successfully'));
  } catch (error) {
    next(error);
  }
});

export default router;
