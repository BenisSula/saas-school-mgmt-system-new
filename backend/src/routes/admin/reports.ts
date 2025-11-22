/**
 * Admin Reporting Routes
 * Provides activity logs, login reports, and performance summaries
 */

import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import tenantResolver from '../../middleware/tenantResolver';
import ensureTenantContext from '../../middleware/ensureTenantContext';
import { requirePermission } from '../../middleware/rbac';
import { validateInput } from '../../middleware/validateInput';
import { z } from 'zod';
import { getPool } from '../../db/connection';
import { createSuccessResponse, createErrorResponse } from '../../lib/responseHelpers';
import { searchAuditLogs } from '../../services/audit/enhancedAuditService';

const router = Router();

router.use(authenticate, tenantResolver(), ensureTenantContext(), requirePermission('users:manage'));

const activityReportSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  limit: z.number().int().positive().max(1000).optional().default(100),
  offset: z.number().int().nonnegative().optional().default(0)
});

/**
 * GET /admin/reports/activity
 * Get activity logs with filters
 */
router.get('/activity', validateInput(activityReportSchema, 'query'), async (req, res, next) => {
  try {
    if (!req.tenant || !req.tenantClient) {
      return res.status(500).json(createErrorResponse('Tenant context missing'));
    }

    const filters = {
      tenantId: req.tenant.id,
      userId: req.query.userId as string | undefined,
      action: req.query.action as string | undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: Number(req.query.limit ?? 100),
      offset: Number(req.query.offset ?? 0)
    };

    const result = await searchAuditLogs(req.tenantClient, filters);

    res.json(createSuccessResponse(result));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/reports/logins
 * Get login reports
 */
router.get('/logins', validateInput(z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  userId: z.string().uuid().optional(),
  limit: z.number().int().positive().max(1000).optional().default(100),
  offset: z.number().int().nonnegative().optional().default(0)
}), 'query'), async (req, res, next) => {
  const pool = getPool();
  try {
    if (!req.tenant) {
      return res.status(500).json(createErrorResponse('Tenant context missing'));
    }

    // Check if login_logs table exists
    let logins: unknown[] = [];
    let total = 0;

    try {
      const conditions: string[] = ['tenant_id = $1'];
      const values: unknown[] = [req.tenant.id];
      let paramIndex = 2;

      if (req.query.startDate) {
        conditions.push(`login_at >= $${paramIndex++}`);
        values.push(new Date(req.query.startDate as string));
      }
      if (req.query.endDate) {
        conditions.push(`login_at <= $${paramIndex++}`);
        values.push(new Date(req.query.endDate as string));
      }
      if (req.query.userId) {
        conditions.push(`user_id = $${paramIndex++}`);
        values.push(req.query.userId);
      }

      const limit = Number(req.query.limit ?? 100);
      const offset = Number(req.query.offset ?? 0);

      // Get total count
      const countResult = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM shared.login_logs WHERE ${conditions.join(' AND ')}`,
        values
      );
      total = Number(countResult.rows[0]?.count ?? 0);

      // Get paginated results
      values.push(limit, offset);
      const result = await pool.query(
        `SELECT 
          id, user_id, ip_address, user_agent, login_at, success, failure_reason
         FROM shared.login_logs
         WHERE ${conditions.join(' AND ')}
         ORDER BY login_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        values
      );

      logins = result.rows;
    } catch (error) {
      // Table might not exist - return empty result
      console.warn('[reports] login_logs table not available:', error);
    }

    res.json(createSuccessResponse({ logins, total }));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/reports/performance
 * Get performance summaries (class/subject performance)
 */
router.get('/performance', validateInput(z.object({
  classId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  academicYear: z.string().optional()
}), 'query'), async (req, res, next) => {
  try {
    if (!req.tenant || !req.tenantClient) {
      return res.status(500).json(createErrorResponse('Tenant context missing'));
    }

    const schema = req.tenant.schema;
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (req.query.classId) {
      conditions.push(`g.class_id = $${paramIndex++}`);
      values.push(req.query.classId);
    }
    if (req.query.subjectId) {
      conditions.push(`g.subject = $${paramIndex++}`);
      values.push(req.query.subjectId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get average scores by class and subject
    const performanceResult = await req.tenantClient.query(
      `SELECT 
        c.name as class_name,
        g.subject,
        COUNT(*) as exam_count,
        AVG(g.score) as avg_score,
        MIN(g.score) as min_score,
        MAX(g.score) as max_score
       FROM ${schema}.grades g
       JOIN ${schema}.classes c ON c.id = g.class_id
       ${whereClause}
       GROUP BY c.name, g.subject
       ORDER BY c.name, g.subject`,
      values
    );

    // Get student performance summary
    const studentPerformanceResult = await req.tenantClient.query(
      `SELECT 
        s.id as student_id,
        s.full_name as student_name,
        c.name as class_name,
        COUNT(DISTINCT g.exam_id) as exams_taken,
        AVG(g.score) as avg_score
       FROM ${schema}.students s
       LEFT JOIN ${schema}.classes c ON c.id = s.class_uuid
       LEFT JOIN ${schema}.grades g ON g.student_id = s.id
       ${whereClause.replace(/g\./g, '')}
       GROUP BY s.id, s.full_name, c.name
       ORDER BY avg_score DESC NULLS LAST
       LIMIT 50`,
      values
    );

    res.json(createSuccessResponse({
      classSubjectPerformance: performanceResult.rows,
      topStudents: studentPerformanceResult.rows
    }));
  } catch (error) {
    next(error);
  }
});

export default router;

