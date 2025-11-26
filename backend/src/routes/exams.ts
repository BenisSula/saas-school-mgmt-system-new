import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import { requirePermission } from '../middleware/rbac';
import { examSchema, examSessionSchema } from '../validators/examValidator';
import {
  createExam,
  createExamSession,
  listExams,
  getGradeScales,
  deleteExam,
} from '../services/examService';
import { safeAuditLogFromRequest } from '../lib/auditHelpers';
import { mutationRateLimiter } from '../middleware/mutationRateLimiter';

const router = Router();

router.use(authenticate, tenantResolver());

router.post('/', requirePermission('exams:manage'), mutationRateLimiter, async (req, res, next) => {
  const tenant = req.tenant;
  if (!req.tenantClient || !tenant || !req.user) {
    return res.status(500).json({ message: 'Tenant context missing' });
  }

  const parsed = examSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.message });
  }

  try {
    const exam = await createExam(req.tenantClient, tenant.schema, parsed.data, req.user.id);

    // Audit log for exam creation
    await safeAuditLogFromRequest(
      req,
      {
        action: 'EXAM_CREATED',
        resourceType: 'exam',
        resourceId: exam.id,
        details: {
          examId: exam.id,
          examName: parsed.data.name,
          examDate: parsed.data.examDate,
          description: parsed.data.description,
        },
        severity: 'info',
      },
      'exams'
    );

    res.status(201).json(exam);
    return;
  } catch (error) {
    next(error);
    return;
  }
});

router.get('/', requirePermission('exams:view'), async (req, res, next) => {
  const tenant = req.tenant;
  if (!req.tenantClient || !tenant) {
    return res.status(500).json({ message: 'Tenant context missing' });
  }

  try {
    const exams = await listExams(req.tenantClient, tenant.schema);
    res.json(exams);
    return;
  } catch (error) {
    next(error);
    return;
  }
});

router.get('/grade-scales', requirePermission('exams:view'), async (req, res, next) => {
  const tenant = req.tenant;
  if (!req.tenantClient || !tenant) {
    return res.status(500).json({ message: 'Tenant context missing' });
  }

  try {
    const scales = await getGradeScales(req.tenantClient, tenant.schema);
    res.json(scales);
    return;
  } catch (error) {
    next(error);
    return;
  }
});

router.post(
  '/:examId/sessions',
  requirePermission('exams:manage'),
  mutationRateLimiter,
  async (req, res, next) => {
    const tenant = req.tenant;
    if (!req.tenantClient || !tenant || !req.user) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }

    const parsed = examSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    try {
      const session = await createExamSession(
        req.tenantClient,
        tenant.schema,
        req.params.examId,
        parsed.data,
        req.user.id
      );

      // Audit log for exam session creation
      await safeAuditLogFromRequest(
        req,
        {
          action: 'EXAM_SESSION_CREATED',
          resourceType: 'exam_session',
          resourceId: session.id,
          details: {
            examId: req.params.examId,
            sessionId: session.id,
            classId: parsed.data.classId,
            subject: parsed.data.subject,
            scheduledAt: parsed.data.scheduledAt,
          },
          severity: 'info',
        },
        'exams'
      );

      res.status(201).json(session);
      return;
    } catch (error) {
      next(error);
      return;
    }
  }
);

router.delete(
  '/:id',
  requirePermission('exams:manage'),
  mutationRateLimiter,
  async (req, res, next) => {
    const tenant = req.tenant;
    if (!req.tenantClient || !tenant || !req.user) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }

    try {
      await deleteExam(req.tenantClient, tenant.schema, req.params.id, req.user.id);

      // Audit log for exam deletion
      await safeAuditLogFromRequest(
        req,
        {
          action: 'EXAM_DELETED',
          resourceType: 'exam',
          resourceId: req.params.id,
          details: {
            examId: req.params.id,
          },
          severity: 'warning',
        },
        'exams'
      );

      res.status(204).send();
      return;
    } catch (error) {
      if (error instanceof Error && error.message === 'Exam not found') {
        return res.status(404).json({ message: error.message });
      }
      next(error);
      return;
    }
  }
);

export default router;
