/**
 * Search Routes
 * Unified search across students, teachers, classes, and subjects
 */

import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import tenantResolver from '../middleware/tenantResolver';
import { requirePermission } from '../middleware/rbac';
import { search } from '../services/searchService';
import { z } from 'zod';

const router = Router();

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  types: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',') : undefined))
    .pipe(z.array(z.enum(['student', 'teacher', 'class', 'subject'])).optional()),
});

router.get(
  '/',
  authenticate,
  tenantResolver(),
  requirePermission('users:manage'),
  async (req, res, next) => {
    try {
      if (!req.tenantClient || !req.tenant) {
        return res.status(500).json({ message: 'Tenant context missing' });
      }

      const parsed = searchQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.message });
      }

      const results = await search(req.tenantClient!, req.tenant!.schema, parsed.data.q, {
        limit: parsed.data.limit,
        types: parsed.data.types,
      });

      res.json({ results });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
