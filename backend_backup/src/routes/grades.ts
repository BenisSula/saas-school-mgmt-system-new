import { Router, Request, Response, NextFunction } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import ensureTenantContext from '../middleware/ensureTenantContext';
import verifyTeacherAssignment from '../middleware/verifyTeacherAssignment';
import { requireAnyPermission } from '../middleware/rbac';
import { bulkOperationLimiter } from '../middleware/mutationRateLimiter';
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
  bulkOperationLimiter,
  extractClassIdForVerification,
  verifyTeacherAssignment({ classIdParam: '_classIdForVerification', allowAdmins: true }),
  async (req, res, next) => {
    const parsed = gradeBulkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    // Server-side validation
    if (!parsed.data.examId) {
      return res.status(400).json({ message: 'examId is required' });
    }
    if (!Array.isArray(parsed.data.entries) || parsed.data.entries.length === 0) {
      return res.status(400).json({ message: 'entries array is required and must not be empty' });
    }
    if (parsed.data.entries.length > 100) {
      return res.status(400).json({ message: 'Maximum 100 grade entries allowed per request' });
    }

    // Validate each entry
    for (const entry of parsed.data.entries) {
      if (!entry.studentId) {
        return res.status(400).json({ message: 'Each entry must have a studentId' });
      }
      if (typeof entry.score !== 'number' || entry.score < 0 || entry.score > 100) {
        return res.status(400).json({ message: 'Each entry must have a valid score between 0 and 100' });
      }
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
