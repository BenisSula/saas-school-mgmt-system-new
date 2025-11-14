import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import ensureTenantContext from '../middleware/ensureTenantContext';
import verifyTeacherAssignment from '../middleware/verifyTeacherAssignment';
import {
  createClassReportPdf,
  findTeacherByEmail,
  getTeacherClassReport,
  getTeacherClassRoster,
  getTeacherOverview,
  getTeacherProfileDetail,
  listTeacherClasses,
  listTeacherMessages,
  requestAssignmentDrop,
  type TeacherRecord
} from '../services/teacherDashboardService';
import { logUnauthorizedAttempt } from '../services/auditLogService';
import { respondTeacherContextMissing, respondTenantContextMissing } from '../lib/friendlyMessages';
import { requireRole } from '../middleware/rbac';

declare module 'express-serve-static-core' {
  interface Request {
    teacherRecord?: TeacherRecord;
  }
}

const router = Router();

router.use(
  authenticate,
  tenantResolver(),
  ensureTenantContext(),
  requireRole(['teacher', 'admin', 'superadmin'])
);

router.use(async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant || !req.user?.email) {
      return respondTeacherContextMissing(res);
    }

    const teacher = await findTeacherByEmail(req.tenantClient, req.tenant.schema, req.user.email);
    if (!teacher) {
      await logUnauthorizedAttempt(req.tenantClient, req.tenant?.schema, {
        userId: req.user?.id ?? null,
        path: req.originalUrl ?? req.path,
        method: req.method,
        reason: 'Teacher profile missing'
      });
      return res.status(403).json({
        message:
          'Access restricted to teacher accounts. Please contact an administrator for assistance.'
      });
    }

    req.teacherRecord = teacher;
    next();
  } catch (error) {
    next(error);
  }
});

router.get('/overview', async (req, res, next) => {
  try {
    const teacher = req.teacherRecord!;
    const overview = await getTeacherOverview(req.tenantClient!, req.tenant!.schema, teacher);
    res.json(overview);
  } catch (error) {
    next(error);
  }
});

router.get('/classes', async (req, res, next) => {
  try {
    const teacher = req.teacherRecord!;
    const classes = await listTeacherClasses(req.tenantClient!, req.tenant!.schema, teacher.id);
    res.json(classes);
  } catch (error) {
    next(error);
  }
});

router.get(
  '/classes/:classId/roster',
  verifyTeacherAssignment({ classIdParam: 'classId', allowAdmins: true }),
  async (req, res, next) => {
    try {
      const teacher = req.teacherRecord!;
      const roster = await getTeacherClassRoster(
        req.tenantClient!,
        req.tenant!.schema,
        teacher.id,
        req.params.classId
      );
      if (!roster) {
        await logUnauthorizedAttempt(req.tenantClient!, req.tenant!.schema, {
          userId: req.user?.id ?? null,
          path: req.originalUrl ?? req.path,
          method: req.method,
          reason: 'Teacher not assigned to class',
          details: { teacherId: teacher.id, classId: req.params.classId }
        });
        return res
          .status(403)
          .json({
            message: 'You are not assigned to this class. Thank you for your understanding.'
          });
      }
      res.json(roster);
    } catch (error) {
      next(error);
    }
  }
);

router.post('/assignments/:assignmentId/drop', async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant) {
      return respondTenantContextMissing(res);
    }

    const teacher = req.teacherRecord!;
    const updated = await requestAssignmentDrop(
      req.tenantClient,
      req.tenant.schema,
      teacher.id,
      req.params.assignmentId
    );
    if (!updated) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
});

router.get(
  '/reports/class/:classId',
  verifyTeacherAssignment({ classIdParam: 'classId', allowAdmins: true }),
  async (req, res, next) => {
    try {
      const teacher = req.teacherRecord!;
      const report = await getTeacherClassReport(
        req.tenantClient!,
        req.tenant!.schema,
        teacher.id,
        req.params.classId
      );
      if (!report) {
        await logUnauthorizedAttempt(req.tenantClient!, req.tenant!.schema, {
          userId: req.user?.id ?? null,
          path: req.originalUrl ?? req.path,
          method: req.method,
          reason: 'Teacher not assigned to class report',
          details: { teacherId: teacher.id, classId: req.params.classId }
        });
        return res
          .status(403)
          .json({
            message: 'You are not assigned to this class. Thank you for your understanding.'
          });
      }
      res.json(report);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/reports/class/:classId/pdf',
  verifyTeacherAssignment({ classIdParam: 'classId', allowAdmins: true }),
  async (req, res, next) => {
    try {
      const teacher = req.teacherRecord!;
      const report = await getTeacherClassReport(
        req.tenantClient!,
        req.tenant!.schema,
        teacher.id,
        req.params.classId
      );
      if (!report) {
        await logUnauthorizedAttempt(req.tenantClient!, req.tenant!.schema, {
          userId: req.user?.id ?? null,
          path: req.originalUrl ?? req.path,
          method: req.method,
          reason: 'Teacher not assigned to class report PDF',
          details: { teacherId: teacher.id, classId: req.params.classId }
        });
        return res
          .status(403)
          .json({
            message: 'You are not assigned to this class. Thank you for your understanding.'
          });
      }

      const pdfBuffer = await createClassReportPdf(report, teacher.name);
      res
        .status(200)
        .setHeader('Content-Type', 'application/pdf')
        .setHeader(
          'Content-Disposition',
          `attachment; filename="class-report-${report.class.name.replace(/\s+/g, '-').toLowerCase()}.pdf"`
        )
        .send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/messages', async (req, res, next) => {
  try {
    const teacher = req.teacherRecord!;
    const messages = await listTeacherMessages(req.tenantClient!, req.tenant!.schema, teacher);
    res.json(messages);
  } catch (error) {
    next(error);
  }
});

router.get('/profile', async (req, res, next) => {
  try {
    const teacher = req.teacherRecord!;
    const profile = await getTeacherProfileDetail(req.tenantClient!, req.tenant!.schema, teacher);
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

export default router;
