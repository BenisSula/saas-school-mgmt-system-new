import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import ensureTenantContext from '../middleware/ensureTenantContext';
import { requirePermission } from '../middleware/rbac';
import { gradeBulkSchema } from '../validators/examValidator';
import { bulkUpsertGrades } from '../services/examService';

const router = Router();

router.use(
  authenticate,
  tenantResolver(),
  ensureTenantContext(),
  requirePermission('grades:manage')
);

router.post('/bulk', async (req, res, next) => {
  const parsed = gradeBulkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.message });
  }

  try {
    // Verify teacher assignment if teacher is submitting grades
    if (req.user?.role === 'teacher' && parsed.data.entries.length > 0) {
      const firstEntry = parsed.data.entries[0];
      if (firstEntry.classId) {
        const { checkTeacherAssignment } = await import('../middleware/verifyTeacherAssignment');
        // Get teacher_id from teachers table using user email
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
            firstEntry.classId
          );
          if (!isAssigned) {
            return res.status(403).json({
              message: 'You are not assigned to this class. Thank you for your understanding.'
            });
          }
        }
      }
    }

    const grades = await bulkUpsertGrades(
      req.tenantClient!,
      req.tenant!.schema,
      parsed.data.examId,
      parsed.data.entries,
      req.user?.id
    );
    res.status(200).json({ saved: grades.length });
  } catch (error) {
    next(error);
  }
});

export default router;
