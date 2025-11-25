/**
 * Admin Dashboard Routes
 * Provides dashboard statistics and KPIs for school admin
 */

import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import tenantResolver from '../../middleware/tenantResolver';
import ensureTenantContext from '../../middleware/ensureTenantContext';
import { requirePermission } from '../../middleware/rbac';
import { getPool } from '../../db/connection';
import { createSuccessResponse, createErrorResponse } from '../../lib/responseHelpers';

const router = Router();

router.use(
  authenticate,
  tenantResolver(),
  ensureTenantContext(),
  requirePermission('users:manage')
);

/**
 * GET /admin/dashboard
 * Get dashboard statistics
 */
router.get('/', async (req, res, next) => {
  const pool = getPool();
  try {
    if (!req.tenant || !req.tenantClient) {
      return res.status(500).json(createErrorResponse('Tenant context missing'));
    }

    const schema = req.tenant.schema;
    const tenantId = req.tenant.id;

    // OPTIMIZED: Combine multiple queries into parallel execution using Promise.all
    // This reduces total query time from sequential to parallel execution
    const [
      userCountsResult,
      hodCountResult,
      schoolResult,
      classCountResult,
      studentCountResult,
      activityCountResult,
      loginCountResult,
    ] = await Promise.all([
      // Get user counts by role
      pool.query<{
        role: string;
        count: string;
        active_count: string;
      }>(
        `SELECT 
          role,
          COUNT(*)::text as count,
          COUNT(*) FILTER (WHERE status = 'active')::text as active_count
         FROM shared.users
         WHERE tenant_id = $1 AND role IN ('teacher', 'student', 'admin')
         GROUP BY role`,
        [tenantId]
      ),
      // Get HOD count
      pool.query<{ count: string }>(
        `SELECT COUNT(DISTINCT ur.user_id)::text as count
         FROM shared.user_roles ur
         JOIN shared.users u ON u.id = ur.user_id
         WHERE u.tenant_id = $1 AND ur.role_name = 'hod'`,
        [tenantId]
      ),
      // Get school ID for department count
      pool.query<{ id: string }>(`SELECT id FROM shared.schools WHERE tenant_id = $1 LIMIT 1`, [
        tenantId,
      ]),
      // Get class count
      req.tenantClient.query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM ${schema}.classes`
      ),
      // Get student count
      req.tenantClient.query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM ${schema}.students`
      ),
      // Get recent activity count (last 7 days)
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text as count
         FROM shared.audit_logs
         WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`,
        [tenantId]
      ),
      // Get login count (last 7 days) - wrapped in try/catch for table existence
      pool
        .query<{ count: string }>(
          `SELECT COUNT(*)::text as count
         FROM shared.login_logs
         WHERE tenant_id = $1 AND login_at >= NOW() - INTERVAL '7 days'`,
          [tenantId]
        )
        .catch(() => ({ rows: [{ count: '0' }] })), // Fallback if table doesn't exist
    ]);

    const userCounts = userCountsResult.rows;
    const schoolId = schoolResult.rows[0]?.id;

    // Get department count if school exists (separate query as it depends on schoolId)
    let departmentCount = 0;
    if (schoolId) {
      const deptResult = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM shared.departments WHERE school_id = $1`,
        [schoolId]
      );
      departmentCount = Number(deptResult.rows[0]?.count ?? 0);
    }

    const stats = {
      users: {
        teachers: Number(userCounts.find((r) => r.role === 'teacher')?.count ?? 0),
        students: Number(userCounts.find((r) => r.role === 'student')?.count ?? 0),
        hods: Number(hodCountResult.rows[0]?.count ?? 0),
        activeTeachers: Number(userCounts.find((r) => r.role === 'teacher')?.active_count ?? 0),
        activeStudents: Number(userCounts.find((r) => r.role === 'student')?.active_count ?? 0),
      },
      departments: departmentCount,
      classes: Number(classCountResult.rows[0]?.count ?? 0),
      students: Number(studentCountResult.rows[0]?.count ?? 0),
      activity: {
        last7Days: Number(activityCountResult.rows[0]?.count ?? 0),
        loginsLast7Days: Number(loginCountResult.rows[0]?.count ?? 0),
      },
    };

    res.json(createSuccessResponse(stats));
    return;
  } catch (error) {
    next(error);
    return;
  }
});

export default router;
