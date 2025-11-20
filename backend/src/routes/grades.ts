import { Router, Request, Response, NextFunction } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import ensureTenantContext from '../middleware/ensureTenantContext';
import verifyTeacherAssignment from '../middleware/verifyTeacherAssignment';
import { requireAnyPermission } from '../middleware/rbac';
import { gradeBulkSchema } from '../validators/examValidator';
import { bulkUpsertGrades } from '../services/examService';

const router = Router();

router.use(
  authenticate,
  tenantResolver(),
  ensureTenantContext()
);

// Middleware to extract classId from request body for teacher assignment verification
const extractClassIdForVerification = (req: Request, res: Response, next: NextFunction) => {
  const parsed = gradeBulkSchema.safeParse(req.body);
  if (parsed.success && parsed.data.entries.length > 0 && parsed.data.entries[0]?.classId) {
    // Attach classId to request for middleware to use
    req.body._classIdForVerification = parsed.data.entries[0].classId;
  }
  next();
};

router.post(
  '/bulk',
  requireAnyPermission('grades:manage', 'grades:enter'),
  extractClassIdForVerification,
  verifyTeacherAssignment({ classIdParam: '_classIdForVerification', allowAdmins: true }),
  async (req, res, next) => {
    const parsed = gradeBulkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    try {
      const grades = await bulkUpsertGrades(
        req.tenantClient!,
        req.tenant!.schema,
        parsed.data.examId,
        parsed.data.entries,
        req.user?.id,
        req.tenant!.id
      );
      res.status(200).json({ saved: grades?.length ?? 0 });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
