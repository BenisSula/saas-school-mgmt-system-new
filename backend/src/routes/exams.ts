import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import { requirePermission } from '../middleware/rbac';
import { examSchema, examSessionSchema } from '../validators/examValidator';
import { createExam, createExamSession, listExams, getGradeScales } from '../services/examService';

const router = Router();

router.use(authenticate, tenantResolver());

router.post('/', requirePermission('exams:manage'), async (req, res, next) => {
  const tenant = req.tenant;
  if (!req.tenantClient || !tenant) {
    return res.status(500).json({ message: 'Tenant context missing' });
  }

  const parsed = examSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.message });
  }

  try {
    const exam = await createExam(req.tenantClient, tenant.schema, parsed.data, req.user?.id);
    res.status(201).json(exam);
  } catch (error) {
    next(error);
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
  } catch (error) {
    next(error);
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
  } catch (error) {
    next(error);
  }
});

router.post('/:examId/sessions', requirePermission('exams:manage'), async (req, res, next) => {
  const tenant = req.tenant;
  if (!req.tenantClient || !tenant) {
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
      req.user?.id
    );
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
});

export default router;
