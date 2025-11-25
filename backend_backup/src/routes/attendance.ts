import { Router, Request, Response, NextFunction } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import ensureTenantContext from '../middleware/ensureTenantContext';
import verifyTeacherAssignment from '../middleware/verifyTeacherAssignment';
import { requireAnyPermission, requireSelfOrPermission, requirePermission } from '../middleware/rbac';
import { attendanceLimiter } from '../middleware/mutationRateLimiter';
import {
  AttendanceMark,
  getAttendanceSummary,
  getClassReport,
  getStudentAttendance,
  markAttendance
} from '../services/attendanceService';

const router = Router();

router.use(authenticate, tenantResolver(), ensureTenantContext());

// Middleware to extract classId from request body for teacher assignment verification
const extractClassIdForVerification = (req: Request, res: Response, next: NextFunction) => {
  const payload = req.body?.records;
  if (Array.isArray(payload) && payload.length > 0 && payload[0]?.classId) {
    // Attach classId to request for middleware to use
    req.body._classIdForVerification = payload[0].classId;
  }
  next();
};

router.post(
  '/mark',
  requireAnyPermission('attendance:manage', 'attendance:mark'),
  attendanceLimiter,
  extractClassIdForVerification,
  verifyTeacherAssignment({ classIdParam: '_classIdForVerification', allowAdmins: true }),
  async (req, res, next) => {
    try {
      const payload = req.body.records as AttendanceMark[];
      if (!Array.isArray(payload) || payload.length === 0) {
        return res.status(400).json({ message: 'records array required' });
      }

      // Server-side validation
      for (const record of payload) {
        if (!record.studentId || !record.classId || !record.date || !record.status) {
          return res.status(400).json({ 
            message: 'Each record must have studentId, classId, date, and status' 
          });
        }
        if (!['present', 'absent', 'late'].includes(record.status)) {
          return res.status(400).json({ 
            message: `Invalid status: ${record.status}. Must be 'present', 'absent', or 'late'` 
          });
        }
      }

      await markAttendance(req.tenantClient!, req.tenant!.schema, payload, req.user?.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:studentId',
  requireSelfOrPermission('students:manage', 'studentId'),
  async (req, res, next) => {
    try {
      const history = await getStudentAttendance(
        req.tenantClient!,
        req.tenant!.schema,
        req.params.studentId,
        req.query.from as string | undefined,
        req.query.to as string | undefined
      );

      const summary = await getAttendanceSummary(
        req.tenantClient!,
        req.tenant!.schema,
        req.params.studentId
      );

      res.json({ history, summary });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/report/class',
  requirePermission('attendance:manage'),
  verifyTeacherAssignment({ classIdParam: 'class_id', allowAdmins: true }),
  async (req, res, next) => {
    try {
      const { class_id: classId, date } = req.query;
      if (!classId || !date) {
        return res.status(400).json({ message: 'class_id and date are required' });
      }

      const report = await getClassReport(
        req.tenantClient!,
        req.tenant!.schema,
        classId as string,
        date as string
      );
      res.json(report);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
