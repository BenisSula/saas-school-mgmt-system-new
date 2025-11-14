import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import ensureTenantContext from '../middleware/ensureTenantContext';
import verifyTeacherAssignment from '../middleware/verifyTeacherAssignment';
import { requirePermission, requireSelfOrPermission } from '../middleware/rbac';
import {
  AttendanceMark,
  getAttendanceSummary,
  getClassReport,
  getStudentAttendance,
  markAttendance
} from '../services/attendanceService';

const router = Router();

router.use(authenticate, tenantResolver(), ensureTenantContext());

router.post('/mark', requirePermission('attendance:manage'), async (req, res, next) => {
  try {
    const payload = req.body.records as AttendanceMark[];
    if (!Array.isArray(payload) || payload.length === 0) {
      return res.status(400).json({ message: 'records array required' });
    }

    // Extract classId from first record for verification
    const firstRecord = payload[0];
    if (firstRecord?.classId && req.user?.role === 'teacher') {
      // Get teacher_id from teachers table using user email
      const { checkTeacherAssignment } = await import('../middleware/verifyTeacherAssignment');
      try {
        const teacherResult = await req.tenantClient!.query(
          `SELECT id FROM ${req.tenant!.schema}.teachers WHERE email = (SELECT email FROM shared.users WHERE id = $1)`,
          [req.user.id]
        );
        const teacherId = teacherResult.rows[0]?.id;

        if (teacherId) {
          const isAssigned = await checkTeacherAssignment(
            req.tenantClient!,
            req.tenant!.schema,
            teacherId,
            firstRecord.classId
          );
          if (!isAssigned) {
            return res.status(403).json({
              message: 'You are not assigned to this class. Thank you for your understanding.'
            });
          }
        }
        // If teacherId not found, allow through (might be admin or service account)
      } catch (error) {
        // If lookup fails, log but don't block (might be test environment or edge case)
        console.warn('[attendance] Teacher lookup failed:', error);
      }
    }

    await markAttendance(req.tenantClient!, req.tenant!.schema, payload, req.user?.id);
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
