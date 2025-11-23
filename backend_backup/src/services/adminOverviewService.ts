/**
 * Admin Overview Service
 * Aggregates data for the admin overview dashboard
 */

import { getPool, getTenantClient } from '../db/connection';
import { getSchool } from './schoolService';
import { listTeachers } from './teacherService';
import { listStudents } from './studentService';
import { listClasses } from './admin/classService';
import { listTenantUsers, type TenantUser } from './userService';

export interface AdminOverviewData {
  school: {
    id: string;
    name: string;
    address: Record<string, unknown> | null;
    createdAt: string;
  } | null;
  totals: {
    users: number;
    teachers: number;
    hods: number;
    students: number;
    admins: number;
    pending: number;
  };
  roleDistribution: Record<string, number>;
  statusDistribution: Record<string, number>;
  activeSessionsCount: number;
  failedLoginAttemptsCount: number;
  recentUsers: Array<{
    id: string;
    email: string;
    role: string;
    status: string | null;
    createdAt: string;
  }>;
  recentTeachers: Array<{
    id: string;
    name: string;
    email: string;
    createdAt: string;
  }>;
  recentStudents: Array<{
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    classId: string | null;
    createdAt: string;
  }>;
  classes: Array<{
    id: string;
    name: string;
    level: string | null;
    studentCount?: number;
  }>;
}

/**
 * Get comprehensive admin overview data
 */
export async function getAdminOverview(tenantId: string, schema: string): Promise<AdminOverviewData> {
  const pool = getPool();
  const tenantClient = await getTenantClient(tenantId);

  try {
    // Get school info
    const school = await getSchool(tenantClient, schema);

    // Get all tenant users
    const users = await listTenantUsers(tenantId);

    // Get teachers
    const teachers = await listTeachers(tenantClient, schema);

    // Get students
    const students = await listStudents(tenantClient, schema);

    // Get classes
    const classes = await listClasses(tenantClient, schema);

    // Calculate totals
    // Note: students count comes from actual students table, not users table
    // because a student record may exist without a corresponding user account
    const totals = {
      users: users.length,
      teachers: users.filter((u) => u.role === 'teacher').length,
      hods: users.filter((u) => u.role === 'hod').length + 
            users.filter((u) => u.additional_roles?.some((r) => r.role === 'hod')).length,
      students: students.length, // Use actual student records count
      admins: users.filter((u) => u.role === 'admin').length,
      pending: users.filter((u) => u.status === 'pending' || !u.is_verified).length
    };

    // Role distribution
    const roleDistribution: Record<string, number> = {};
    users.forEach((user) => {
      roleDistribution[user.role] = (roleDistribution[user.role] || 0) + 1;
      // Also count additional roles
      if (user.additional_roles) {
        user.additional_roles.forEach((ar) => {
          roleDistribution[ar.role] = (roleDistribution[ar.role] || 0) + 1;
        });
      }
    });

    // Status distribution
    const statusDistribution: Record<string, number> = {};
    users.forEach((user) => {
      const status = user.status || 'active';
      statusDistribution[status] = (statusDistribution[status] || 0) + 1;
    });

    // Active sessions count (last 24 hours)
    const activeSessionsResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text as count
       FROM shared.user_sessions
       WHERE tenant_id = $1 
         AND updated_at >= NOW() - INTERVAL '24 hours'
         AND expires_at > NOW()`,
      [tenantId]
    );
    const activeSessionsCount = parseInt(activeSessionsResult.rows[0]?.count || '0', 10);

    // Failed login attempts count (last 24 hours)
    const failedLoginsResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text as count
       FROM shared.login_attempts
       WHERE tenant_id = $1 
         AND success = false
         AND attempted_at >= NOW() - INTERVAL '24 hours'`,
      [tenantId]
    );
    const failedLoginAttemptsCount = parseInt(failedLoginsResult.rows[0]?.count || '0', 10);

    // Recent users (last 10)
    const recentUsers = users
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        status: u.status,
        createdAt: u.created_at
      }));

    // Recent teachers (last 10)
    const recentTeachers = teachers
      .sort((a: { created_at?: string }, b: { created_at?: string }) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 10)
      .map((t: { id: string; name: string; email: string; created_at?: string }) => ({
        id: t.id,
        name: t.name || '',
        email: t.email || '',
        createdAt: t.created_at || new Date().toISOString()
      }));

    // Recent students (last 10)
    const recentStudents = students
      .sort((a: { created_at?: string }, b: { created_at?: string }) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 10)
      .map((s: {
        id: string;
        first_name?: string;
        last_name?: string;
        admission_number?: string;
        class_id?: string | null;
        created_at?: string;
      }) => ({
        id: s.id,
        firstName: s.first_name || '',
        lastName: s.last_name || '',
        admissionNumber: s.admission_number || '',
        classId: s.class_id || null,
        createdAt: s.created_at || new Date().toISOString()
      }));

    // Classes with student counts
    const classesWithCounts = await Promise.all(
      classes.map(async (cls: { id: string; name: string; gradeLevel?: string | null; studentCount?: number }) => {
        // If studentCount is already available from listClasses, use it
        if (cls.studentCount !== undefined) {
          return {
            id: cls.id,
            name: cls.name,
            level: cls.gradeLevel || null,
            studentCount: cls.studentCount
          };
        }
        
        // Otherwise, query for student count
        const studentCountResult = await tenantClient.query<{ count: string }>(
          `SELECT COUNT(*)::text as count
           FROM ${schema}.students
           WHERE class_id = $1 OR class_uuid = $1`,
          [cls.id]
        );
        return {
          id: cls.id,
          name: cls.name,
          level: cls.gradeLevel || null,
          studentCount: parseInt(studentCountResult.rows[0]?.count || '0', 10)
        };
      })
    );

    return {
      school: school
        ? {
            id: school.id,
            name: school.name || '',
            address: (school.address as Record<string, unknown>) || null,
            createdAt: school.created_at || new Date().toISOString()
          }
        : null,
      totals,
      roleDistribution,
      statusDistribution,
      activeSessionsCount,
      failedLoginAttemptsCount,
      recentUsers,
      recentTeachers,
      recentStudents,
      classes: classesWithCounts
    };
  } finally {
    tenantClient.release();
  }
}

