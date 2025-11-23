import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import { requirePermission } from '../middleware/rbac';
import {
  getAttendanceSummary,
  getDepartmentAnalytics,
  getGradeDistribution,
  getFeeOutstanding
} from '../services/reportService';

const router = Router();

router.use(authenticate, tenantResolver());

router.get('/attendance', requirePermission('attendance:manage'), async (req, res, next) => {
  try {
    if (!req.tenant || !req.tenantClient) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }
    const { from, to, class_id: classId } = req.query as Record<string, string | undefined>;
    const summary = await getAttendanceSummary(req.tenantClient, req.tenant.schema, {
      from,
      to,
      classId
    });
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

router.get('/grades', requirePermission('exams:view'), async (req, res, next) => {
  try {
    if (!req.tenant || !req.tenantClient) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }
    const { exam_id: examId } = req.query as Record<string, string | undefined>;
    if (!examId) {
      return res.status(400).json({ message: 'exam_id is required' });
    }
    const distribution = await getGradeDistribution(req.tenantClient, req.tenant.schema, examId);
    res.json(distribution);
  } catch (error) {
    next(error);
  }
});

router.get('/fees', requirePermission('fees:manage'), async (req, res, next) => {
  try {
    if (!req.tenant || !req.tenantClient) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }
    const { status } = req.query as Record<string, string | undefined>;
    const fees = await getFeeOutstanding(req.tenantClient, req.tenant.schema, status);
    res.json(fees);
  } catch (error) {
    next(error);
  }
});

router.get('/department-analytics', requirePermission('department-analytics'), async (req, res, next) => {
  try {
    if (!req.tenant || !req.tenantClient) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }
    const { department_id: departmentId } = req.query as Record<string, string | undefined>;
    const analytics = await getDepartmentAnalytics(req.tenantClient, req.tenant.schema, departmentId);
    res.json(analytics);
  } catch (error) {
    next(error);
  }
});

export default router;
