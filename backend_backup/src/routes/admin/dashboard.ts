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

router.use(authenticate, tenantResolver(), ensureTenantContext(), requirePermission('users:manage'));

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

    // Get user counts by role
    const userCounts = await pool.query<{
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
      [req.tenant.id]
    );

    // Get HOD count
    const hodCount = await pool.query<{ count: string }>(
      `SELECT COUNT(DISTINCT ur.user_id)::text as count
       FROM shared.user_roles ur
       JOIN shared.users u ON u.id = ur.user_id
       WHERE u.tenant_id = $1 AND ur.role_name = 'hod'`,
      [req.tenant.id]
    );

    // Get department count
    const schoolResult = await pool.query<{ id: string }>(
      `SELECT id FROM shared.schools WHERE tenant_id = $1 LIMIT 1`,
      [req.tenant.id]
    );
    const schoolId = schoolResult.rows[0]?.id;
    
    let departmentCount = 0;
    if (schoolId) {
      const deptResult = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM shared.departments WHERE school_id = $1`,
        [schoolId]
      );
      departmentCount = Number(deptResult.rows[0]?.count ?? 0);
    }

    // Get class count
    const classCount = await req.tenantClient.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM ${schema}.classes`
    );

    // Get student count
    const studentCount = await req.tenantClient.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM ${schema}.students`
    );

    // Get recent activity count (last 7 days)
    const activityCount = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text as count
       FROM shared.audit_logs
       WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`,
      [req.tenant.id]
    );

    // Get login count (last 7 days) - if login logs table exists
    let loginCount = 0;
    try {
      const loginResult = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text as count
         FROM shared.login_logs
         WHERE tenant_id = $1 AND login_at >= NOW() - INTERVAL '7 days'`,
        [req.tenant.id]
      );
      loginCount = Number(loginResult.rows[0]?.count ?? 0);
    } catch {
      // Table might not exist
    }

    const stats = {
      users: {
        teachers: Number(userCounts.rows.find(r => r.role === 'teacher')?.count ?? 0),
        students: Number(userCounts.rows.find(r => r.role === 'student')?.count ?? 0),
        hods: Number(hodCount.rows[0]?.count ?? 0),
        activeTeachers: Number(userCounts.rows.find(r => r.role === 'teacher')?.active_count ?? 0),
        activeStudents: Number(userCounts.rows.find(r => r.role === 'student')?.active_count ?? 0)
      },
      departments: departmentCount,
      classes: Number(classCount.rows[0]?.count ?? 0),
      students: Number(studentCount.rows[0]?.count ?? 0),
      activity: {
        last7Days: Number(activityCount.rows[0]?.count ?? 0),
        loginsLast7Days: loginCount
      }
    };

    res.json(createSuccessResponse(stats));
  } catch (error) {
    next(error);
  }
});

export default router;

