import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import { requirePermission } from '../middleware/rbac';
import { validateInput } from '../middleware/validateInput';
import { parsePagination, createPaginatedResponse } from '../middleware/pagination';
import { examSchema, examSessionSchema } from '../validators/examValidator';
import { z } from 'zod';
import {
  createExam,
  createExamSession,
  listExams,
  getGradeScales,
  deleteExam
} from '../services/examService';

const router = Router();

router.use(authenticate, tenantResolver());

router.post('/', requirePermission('exams:manage'), validateInput(examSchema, 'body'), async (req, res, next) => {
  const tenant = req.tenant;
  if (!req.tenantClient || !tenant) {
    return res.status(500).json({ message: 'Tenant context missing' });
  }

  try {
    const exam = await createExam(req.tenantClient, tenant.schema, req.body, req.user?.id);
    res.status(201).json(exam);
  } catch (error) {
    next(error);
  }
});

const listExamsQuerySchema = z.object({
  limit: z.string().optional(),
  offset: z.string().optional(),
  page: z.string().optional()
}).passthrough();

router.get('/', requirePermission('exams:view'), parsePagination, validateInput(listExamsQuerySchema, 'query'), async (req, res, next) => {
  const tenant = req.tenant;
  if (!req.tenantClient || !tenant) {
    return res.status(500).json({ message: 'Tenant context missing' });
  }

  try {
    const allExams = await listExams(req.tenantClient, tenant.schema);
    const pagination = req.pagination!;
    const paginated = allExams.slice(pagination.offset, pagination.offset + pagination.limit);
    const response = createPaginatedResponse(paginated, allExams.length, pagination);
    res.json(response);
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

const examIdParamSchema = z.object({
  examId: z.string().uuid('Invalid exam ID format')
});

router.post('/:examId/sessions', requirePermission('exams:manage'), validateInput(examIdParamSchema, 'params'), validateInput(examSessionSchema, 'body'), async (req, res, next) => {
  const tenant = req.tenant;
  if (!req.tenantClient || !tenant) {
    return res.status(500).json({ message: 'Tenant context missing' });
  }

  try {
    const session = await createExamSession(
      req.tenantClient,
      tenant.schema,
      req.params.examId,
      req.body,
      req.user?.id
    );
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
});

router.delete('/:examId', requirePermission('exams:manage'), validateInput(examIdParamSchema, 'params'), async (req, res, next) => {
  const tenant = req.tenant;
  if (!req.tenantClient || !tenant) {
    return res.status(500).json({ message: 'Tenant context missing' });
  }

  try {
    await deleteExam(req.tenantClient, tenant.schema, req.params.examId, req.user?.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
