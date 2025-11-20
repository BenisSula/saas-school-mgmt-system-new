/**
 * RBAC Filtering Utilities
 * 
 * These functions help filter data based on user roles and permissions,
 * ensuring proper data isolation at tenant, school, department, and class levels.
 */

import type { PoolClient } from 'pg';
import type { Role } from '../config/permissions';

export interface UserContext {
  id: string;
  role: Role;
  tenantId: string;
  schoolId?: string | null;
  departmentId?: string | null;
}

/**
 * Get user's department ID from shared.users table
 */
export async function getUserDepartmentId(
  poolClient: PoolClient,
  userId: string
): Promise<string | null> {
  const result = await poolClient.query<{ department_id: string | null }>(
    `SELECT department_id FROM shared.users WHERE id = $1`,
    [userId]
  );
  return result.rows[0]?.department_id ?? null;
}

/**
 * Get user's school ID from shared.users table
 */
export async function getUserSchoolId(
  poolClient: PoolClient,
  userId: string
): Promise<string | null> {
  const result = await poolClient.query<{ school_id: string | null }>(
    `SELECT school_id FROM shared.users WHERE id = $1`,
    [userId]
  );
  return result.rows[0]?.school_id ?? null;
}

/**
 * Check if user is HOD (has 'hod' role in user_roles)
 */
export async function isUserHOD(poolClient: PoolClient, userId: string): Promise<boolean> {
  const result = await poolClient.query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM shared.user_roles WHERE user_id = $1 AND role_name = 'hod'`,
    [userId]
  );
  return parseInt(result.rows[0]?.count ?? '0', 10) > 0;
}

/**
 * Get classes in a department
 */
export async function getDepartmentClasses(
  poolClient: PoolClient,
  schema: string,
  departmentId: string
): Promise<string[]> {
  const result = await poolClient.query<{ id: string }>(
    `SELECT id FROM ${schema}.classes WHERE department_id = $1`,
    [departmentId]
  );
  return result.rows.map((row) => row.id);
}

/**
 * Get teacher's assigned class IDs
 */
export async function getTeacherAssignedClasses(
  poolClient: PoolClient,
  schema: string,
  teacherId: string
): Promise<string[]> {
  const result = await poolClient.query<{ class_id: string }>(
    `SELECT DISTINCT class_id FROM ${schema}.teacher_assignments WHERE teacher_id = $1`,
    [teacherId]
  );
  return result.rows.map((row) => row.class_id);
}

/**
 * Get teacher's assigned class IDs from teacher profile
 */
export async function getTeacherClassesFromProfile(
  poolClient: PoolClient,
  schema: string,
  teacherEmail: string
): Promise<string[]> {
  const result = await poolClient.query<{ assigned_classes: string | null }>(
    `SELECT assigned_classes FROM ${schema}.teachers WHERE email = $1`,
    [teacherEmail]
  );
  if (!result.rows[0]?.assigned_classes) {
    return [];
  }
  try {
    const classes = JSON.parse(result.rows[0].assigned_classes);
    return Array.isArray(classes) ? classes : [];
  } catch {
    return [];
  }
}

/**
 * Build WHERE clause for HOD filtering (department-level access)
 */
export function buildHODWhereClause(
  schema: string,
  departmentId: string | null,
  tableAlias = ''
): string {
  if (!departmentId) {
    return '1=0'; // No access if no department
  }

  const prefix = tableAlias ? `${tableAlias}.` : '';
  
  // HOD can access:
  // 1. Classes in their department
  // 2. Students in those classes
  // 3. Teachers in their department
  // 4. Subjects taught in department classes
  
  return `
    EXISTS (
      SELECT 1 FROM ${schema}.classes c
      WHERE c.department_id = $1
      AND (
        ${prefix}class_uuid = c.id
        OR ${prefix}class_id = c.id
        OR ${prefix}id IN (
          SELECT student_id FROM ${schema}.student_subjects ss
          JOIN ${schema}.class_subjects cs ON ss.subject_id = cs.subject_id
          WHERE cs.class_id = c.id
        )
      )
    )
  `;
}

/**
 * Build WHERE clause for Teacher filtering (class-level access)
 */
export function buildTeacherWhereClause(
  schema: string,
  classIds: string[],
  tableAlias = ''
): string {
  if (classIds.length === 0) {
    return '1=0'; // No access if no classes assigned
  }

  const prefix = tableAlias ? `${tableAlias}.` : '';
  const placeholders = classIds.map((_, i) => `$${i + 1}`).join(', ');
  
  return `
    ${prefix}class_uuid IN (${placeholders})
    OR ${prefix}class_id IN (SELECT name FROM ${schema}.classes WHERE id IN (${placeholders}))
  `;
}

/**
 * Build WHERE clause for Student filtering (self-access)
 */
export function buildStudentWhereClause(userId: string, tableAlias = ''): string {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  return `${prefix}user_id = $1`;
}

/**
 * Filter teachers by department (for HOD access)
 */
export async function filterTeachersByDepartment(
  poolClient: PoolClient,
  schema: string,
  departmentId: string | null,
  teachers: any[]
): Promise<any[]> {
  if (!departmentId) {
    return [];
  }

  // Get teachers in department from shared.users
  const result = await poolClient.query<{ email: string }>(
    `SELECT email FROM shared.users WHERE department_id = $1 AND role = 'teacher'`,
    [departmentId]
  );
  
  const departmentTeacherEmails = new Set(result.rows.map((r) => r.email.toLowerCase()));
  
  return teachers.filter((teacher) =>
    departmentTeacherEmails.has(teacher.email?.toLowerCase() ?? '')
  );
}

/**
 * Filter students by department classes (for HOD access)
 */
export async function filterStudentsByDepartment(
  poolClient: PoolClient,
  schema: string,
  departmentId: string | null,
  students: any[]
): Promise<any[]> {
  if (!departmentId) {
    return [];
  }

  const departmentClassIds = await getDepartmentClasses(poolClient, schema, departmentId);
  if (departmentClassIds.length === 0) {
    return [];
  }

  const classIdSet = new Set(departmentClassIds);
  
  return students.filter((student) => {
    if (student.class_uuid && classIdSet.has(student.class_uuid)) {
      return true;
    }
    // Also check by class name if class_uuid not available
    if (student.class_id) {
      // Would need to check class name mapping, but for now return true if class_uuid matches
      return false; // Conservative: only match by UUID
    }
    return false;
  });
}

/**
 * Filter students by teacher's assigned classes
 */
export async function filterStudentsByTeacherClasses(
  poolClient: PoolClient,
  schema: string,
  teacherId: string,
  students: any[]
): Promise<any[]> {
  const classIds = await getTeacherAssignedClasses(poolClient, schema, teacherId);
  if (classIds.length === 0) {
    return [];
  }

  const classIdSet = new Set(classIds);
  
  return students.filter((student) => {
    return student.class_uuid && classIdSet.has(student.class_uuid);
  });
}

