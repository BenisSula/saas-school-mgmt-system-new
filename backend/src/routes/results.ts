import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import { requirePermission, requireSelfOrPermission } from '../middleware/rbac';
import { computeStudentResult, generateExamExport } from '../services/examService';
import { respondTenantContextMissing } from '../lib/friendlyMessages';

const router = Router();

router.use(authenticate, tenantResolver());

router.get('/:examId/export', requirePermission('exams:manage'), async (req, res, next) => {
  const tenant = req.tenant;
  if (!req.tenantClient || !tenant) {
    return respondTenantContextMissing(res);
  }

  const format = (req.query.format as string | undefined)?.toLowerCase() === 'pdf' ? 'pdf' : 'csv';

  try {
    const exportData = await generateExamExport(
      req.tenantClient,
      tenant.schema,
      req.params.examId,
      format
    );
    res.setHeader('Content-Type', exportData.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportData.filename}"`);
    res.send(exportData.buffer);
    return;
  } catch (error) {
    next(error);
    return;
  }
});

router.get(
  '/:studentId',
  requireSelfOrPermission('exams:manage', 'studentId'),
  async (req, res, next) => {
    const tenant = req.tenant;
    if (!req.tenantClient || !tenant) {
      return respondTenantContextMissing(res);
    }

    const examId = req.query.exam_id as string | undefined;
    if (!examId) {
      return res.status(400).json({ message: 'exam_id query parameter is required' });
    }

    try {
      const result = await computeStudentResult(
        req.tenantClient,
        tenant.schema,
        req.params.studentId,
        examId
      );
      res.json(result);
      return;
    } catch (error) {
      next(error);
      return;
    }
  }
);

export default router;
