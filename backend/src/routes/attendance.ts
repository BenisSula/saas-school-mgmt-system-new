import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import { requirePermission } from '../middleware/rbac';
import { requireSelfOrPermission } from '../middleware/authGuards';
import { respondTenantContextMissing } from '../lib/friendlyMessages';
import {
  AttendanceMark,
  getAttendanceSummary,
  getClassReport,
  getStudentAttendance,
  markAttendance
} from '../services/attendanceService';

const router = Router();

router.use(authenticate, tenantResolver());

router.post('/mark', requirePermission('attendance:manage'), async (req, res, next) => {
  try {
    const payload = req.body.records as AttendanceMark[];
    if (!Array.isArray(payload) || payload.length === 0) {
      return res.status(400).json({ message: 'records array required' });
    }

    if (!req.tenantClient || !req.tenant) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }

    await markAttendance(req.tenantClient!, req.tenant.schema, payload);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get(
  '/:studentId',
  requireSelfOrPermission('students:manage', 'studentId'),
  async (req, res, next) => {
    try {
      if (!req.tenantClient || !req.tenant) {
        return respondTenantContextMissing(res);
      }

      const history = await getStudentAttendance(
        req.tenantClient!,
        req.tenant.schema,
        req.params.studentId,
        req.query.from as string | undefined,
        req.query.to as string | undefined
      );

      const summary = await getAttendanceSummary(
        req.tenantClient!,
        req.tenant.schema,
        req.params.studentId
      );

      res.json({ history, summary });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/report/class', requirePermission('attendance:manage'), async (req, res, next) => {
  try {
    if (!req.tenantClient || !req.tenant) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }

    const { class_id: classId, date } = req.query;
    if (!classId || !date) {
      return res.status(400).json({ message: 'class_id and date are required' });
    }

    const report = await getClassReport(
      req.tenantClient!,
      req.tenant.schema,
      classId as string,
      date as string
    );
    res.json(report);
  } catch (error) {
    next(error);
  }
});

export default router;
