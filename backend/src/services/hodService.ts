/**
 * HOD (Head of Department) Service
 * Handles HOD-specific operations: dashboard, teacher oversight, department analytics
 *
 * DRY: Reuses existing services and utilities
 * Multi-tenant: All operations scoped to tenant and department
 */

import type { PoolClient } from 'pg';
import { getPool } from '../db/connection';
import { createAuditLog } from './audit/enhancedAuditService';
import { getHODDepartmentId, getUserWithAdditionalRoles } from '../lib/roleUtils';
import { getSchoolIdForTenant } from './shared/adminHelpers';

export interface HODOverview {
  department: {
    id: string;
    name: string;
  };
  teachers: {
    total: number;
    active: number;
    bySubject: Array<{ subject: string; count: number }>;
  };
  classes: {
    total: number;
    byLevel: Array<{ level: string; count: number }>;
  };
  performance: {
    avgScore: number;
    totalExams: number;
    recentActivity: number; // Last 7 days
  };
}

export interface TeacherUnderHOD {
  id: string;
  name: string;
  email: string | null;
  subjects: string[];
  classes: string[];
  lastActive: string | null;
  performanceScore?: number;
}

export interface DepartmentReport {
  department: {
    id: string;
    name: string;
  };
  summary: {
    teachers: number;
    classes: number;
    students: number;
  };
  performance: {
    avgScore: number;
    topPerformingClass: string | null;
    improvementTrend: number; // Percentage change
  };
  activity: {
    last7Days: number;
    last30Days: number;
  };
}

/**
 * Get HOD overview dashboard data
 */
export async function getHodOverview(
  client: PoolClient,
  tenantId: string,
  schema: string,
  hodUserId: string
): Promise<HODOverview> {
  // Get HOD user with additional roles
  const hodUser = await getUserWithAdditionalRoles(client, hodUserId, tenantId);
  if (!hodUser) {
    throw new Error('HOD user not found');
  }

  // Get department ID from HOD's additional role metadata
  const departmentId = getHODDepartmentId(hodUser);
  if (!departmentId) {
    throw new Error('HOD is not assigned to a department');
  }

  // Get school ID
  const schoolId = await getSchoolIdForTenant(tenantId);
  if (!schoolId) {
    throw new Error('School not found for tenant');
  }

  const pool = getPool();

  // Get department info
  const deptResult = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM shared.departments WHERE id = $1 AND school_id = $2`,
    [departmentId, schoolId]
  );

  if (deptResult.rows.length === 0) {
    throw new Error('Department not found');
  }

  const department = deptResult.rows[0];

  // Get teachers in department
  const teachersResult = await pool.query<{
    id: string;
    name: string;
    email: string | null;
    status: string;
  }>(
    `SELECT u.id, u.full_name as name, u.email, u.status
     FROM shared.users u
     WHERE u.department_id = $1 AND u.tenant_id = $2 AND u.role = 'teacher'`,
    [departmentId, tenantId]
  );

  const teachers = teachersResult.rows;
  const activeTeachers = teachers.filter((t) => t.status === 'active');

  // Get subjects taught by department teachers
  const subjectsResult = await client.query<{ subject: string; count: string }>(
    `SELECT s.name as subject, COUNT(DISTINCT sta.teacher_user_id)::text as count
     FROM ${schema}.subject_teacher_assignments sta
     JOIN ${schema}.subjects s ON s.id = sta.subject_id
     JOIN shared.users u ON u.id = sta.teacher_user_id
     WHERE u.department_id = $1 AND u.tenant_id = $2
     GROUP BY s.name`,
    [departmentId, tenantId]
  );

  // Get classes in department
  const classesResult = await client.query<{
    id: string;
    grade_level: string | null;
  }>(`SELECT id, grade_level FROM ${schema}.classes WHERE department_id = $1`, [departmentId]);

  const classes = classesResult.rows;
  const byLevel = new Map<string, number>();
  classes.forEach((c) => {
    const level = c.grade_level || 'Unspecified';
    byLevel.set(level, (byLevel.get(level) || 0) + 1);
  });

  // Get performance data (last 30 days)
  const performanceResult = await client.query<{
    avg_score: number | null;
    exam_count: string;
  }>(
    `SELECT AVG(g.score) as avg_score, COUNT(DISTINCT g.exam_id)::text as exam_count
     FROM ${schema}.grades g
     JOIN ${schema}.students s ON s.id = g.student_id
     JOIN ${schema}.classes c ON c.id = s.class_uuid
     WHERE c.department_id = $1 AND g.created_at >= NOW() - INTERVAL '30 days'`,
    [departmentId]
  );

  // Get recent activity count (last 7 days)
  const activityResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text as count
     FROM shared.audit_logs
     WHERE tenant_id = $1 AND resource_type IN ('grade', 'attendance', 'exam')
     AND created_at >= NOW() - INTERVAL '7 days'`,
    [tenantId]
  );

  // Audit log
  await createAuditLog(client, {
    userId: hodUserId,
    action: 'HOD_VIEWED_DASHBOARD',
    resourceType: 'department',
    resourceId: departmentId,
    details: { departmentName: department.name },
    severity: 'info',
    tags: ['hod', 'dashboard', 'department'],
  });

  return {
    department: {
      id: department.id,
      name: department.name,
    },
    teachers: {
      total: teachers.length,
      active: activeTeachers.length,
      bySubject: subjectsResult.rows.map((r) => ({
        subject: r.subject,
        count: Number(r.count),
      })),
    },
    classes: {
      total: classes.length,
      byLevel: Array.from(byLevel.entries()).map(([level, count]) => ({
        level,
        count,
      })),
    },
    performance: {
      avgScore: Number(performanceResult.rows[0]?.avg_score ?? 0),
      totalExams: Number(performanceResult.rows[0]?.exam_count ?? 0),
      recentActivity: Number(activityResult.rows[0]?.count ?? 0),
    },
  };
}

/**
 * List teachers under HOD's department
 */
export async function listTeachersUnderHOD(
  client: PoolClient,
  tenantId: string,
  schema: string,
  hodUserId: string,
  filters?: { search?: string; subject?: string }
): Promise<TeacherUnderHOD[]> {
  // Get HOD user and department
  const hodUser = await getUserWithAdditionalRoles(client, hodUserId, tenantId);
  if (!hodUser) {
    throw new Error('HOD user not found');
  }

  const departmentId = getHODDepartmentId(hodUser);
  if (!departmentId) {
    throw new Error('HOD is not assigned to a department');
  }

  const pool = getPool();

  // Build query
  let query = `
    SELECT DISTINCT
      u.id,
      u.full_name as name,
      u.email,
      u.status,
      t.subjects,
      ARRAY_AGG(DISTINCT c.id) FILTER (WHERE c.id IS NOT NULL) as class_ids,
      MAX(al.created_at) as last_active
    FROM shared.users u
    LEFT JOIN ${schema}.teachers t ON t.user_id = u.id
    LEFT JOIN ${schema}.subject_teacher_assignments sta ON sta.teacher_user_id = u.id
    LEFT JOIN ${schema}.classes c ON c.id = sta.class_id OR c.class_teacher_id = u.id
    LEFT JOIN shared.audit_logs al ON al.user_id = u.id AND al.created_at >= NOW() - INTERVAL '30 days'
    WHERE u.department_id = $1 AND u.tenant_id = $2 AND u.role = 'teacher'
  `;

  const params: unknown[] = [departmentId, tenantId];
  let paramIndex = 3;

  if (filters?.search) {
    query += ` AND (u.full_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  if (filters?.subject) {
    query += ` AND $${paramIndex} = ANY(t.subjects)`;
    params.push(filters.subject);
    paramIndex++;
  }

  query += `
    GROUP BY u.id, u.full_name, u.email, u.status, t.subjects
    ORDER BY u.full_name
  `;

  const result = await pool.query(query, params);

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name || 'Unknown',
    email: row.email,
    subjects: Array.isArray(row.subjects) ? row.subjects : [],
    classes: Array.isArray(row.class_ids) ? row.class_ids.filter((id: unknown) => id !== null) : [],
    lastActive: row.last_active ? new Date(row.last_active).toISOString() : null,
  }));
}

/**
 * Get department-level report
 */
export async function getDepartmentReport(
  client: PoolClient,
  tenantId: string,
  schema: string,
  hodUserId: string,
  filters?: { term?: string; classId?: string; subjectId?: string }
): Promise<DepartmentReport> {
  // Get HOD user and department
  const hodUser = await getUserWithAdditionalRoles(client, hodUserId, tenantId);
  if (!hodUser) {
    throw new Error('HOD user not found');
  }

  const departmentId = getHODDepartmentId(hodUser);
  if (!departmentId) {
    throw new Error('HOD is not assigned to a department');
  }

  const pool = getPool();
  const schoolId = await getSchoolIdForTenant(tenantId);
  if (!schoolId) {
    throw new Error('School not found for tenant');
  }

  // Get department info
  const deptResult = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM shared.departments WHERE id = $1 AND school_id = $2`,
    [departmentId, schoolId]
  );

  if (deptResult.rows.length === 0) {
    throw new Error('Department not found');
  }

  const department = deptResult.rows[0];

  // Get summary counts
  const teachersCount = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM shared.users 
     WHERE department_id = $1 AND tenant_id = $2 AND role = 'teacher'`,
    [departmentId, tenantId]
  );

  const classesCount = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM ${schema}.classes WHERE department_id = $1`,
    [departmentId]
  );

  const studentsCount = await client.query<{ count: string }>(
    `SELECT COUNT(DISTINCT s.id)::text as count
     FROM ${schema}.students s
     JOIN ${schema}.classes c ON c.id = s.class_uuid
     WHERE c.department_id = $1`,
    [departmentId]
  );

  // Get performance data
  let performanceQuery = `
    SELECT AVG(g.score) as avg_score
    FROM ${schema}.grades g
    JOIN ${schema}.students s ON s.id = g.student_id
    JOIN ${schema}.classes c ON c.id = s.class_uuid
    WHERE c.department_id = $1
  `;
  const perfParams: unknown[] = [departmentId];

  if (filters?.classId) {
    performanceQuery += ` AND c.id = $2`;
    perfParams.push(filters.classId);
  }

  const performanceResult = await client.query<{ avg_score: number | null }>(
    performanceQuery,
    perfParams
  );

  // Get top performing class
  const topClassResult = await client.query<{ class_name: string | null }>(
    `SELECT c.name as class_name
     FROM ${schema}.classes c
     JOIN ${schema}.students s ON s.class_uuid = c.id
     JOIN ${schema}.grades g ON g.student_id = s.id
     WHERE c.department_id = $1
     GROUP BY c.id, c.name
     ORDER BY AVG(g.score) DESC
     LIMIT 1`,
    [departmentId]
  );

  // Get activity counts
  const activity7Days = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text as count
     FROM shared.audit_logs
     WHERE tenant_id = $1 AND resource_type IN ('grade', 'attendance', 'exam')
     AND created_at >= NOW() - INTERVAL '7 days'`,
    [tenantId]
  );

  const activity30Days = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text as count
     FROM shared.audit_logs
     WHERE tenant_id = $1 AND resource_type IN ('grade', 'attendance', 'exam')
     AND created_at >= NOW() - INTERVAL '30 days'`,
    [tenantId]
  );

  // Audit log
  await createAuditLog(client, {
    userId: hodUserId,
    action: 'HOD_VIEWED_DEPARTMENT_REPORT',
    resourceType: 'department',
    resourceId: departmentId,
    details: { departmentName: department.name, filters },
    severity: 'info',
    tags: ['hod', 'report', 'department'],
  });

  return {
    department: {
      id: department.id,
      name: department.name,
    },
    summary: {
      teachers: Number(teachersCount.rows[0]?.count ?? 0),
      classes: Number(classesCount.rows[0]?.count ?? 0),
      students: Number(studentsCount.rows[0]?.count ?? 0),
    },
    performance: {
      avgScore: Number(performanceResult.rows[0]?.avg_score ?? 0),
      topPerformingClass: topClassResult.rows[0]?.class_name || null,
      improvementTrend: 0, // TODO: Calculate trend from historical data
    },
    activity: {
      last7Days: Number(activity7Days.rows[0]?.count ?? 0),
      last30Days: Number(activity30Days.rows[0]?.count ?? 0),
    },
  };
}
