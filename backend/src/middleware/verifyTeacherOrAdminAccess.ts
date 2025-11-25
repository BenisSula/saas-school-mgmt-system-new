/**
 * Verify Teacher or Admin Access Middleware
 * Allows access if user is admin OR if user is teacher assigned to the class
 * DRY: Centralizes teacher/admin access verification
 */

import type { Request, Response, NextFunction } from 'express';
import { getPool } from '../db/connection';
import { hasPermission, type Role } from '../config/permissions';
import { getAllUserRoles, type UserWithRoles } from '../lib/roleUtils';
import { createErrorResponse } from '../lib/responseHelpers';

/**
 * Verify teacher assignment to a class
 * @param userId - User ID
 * @param classId - Class ID
 * @param tenantId - Tenant ID
 * @param schema - Tenant schema
 * @returns true if teacher is assigned to class
 */
async function verifyTeacherAssignment(
  userId: string,
  classId: string,
  tenantId: string,
  schema: string
): Promise<boolean> {
  const pool = getPool();

  // Check if user is assigned as class teacher
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text as count
     FROM ${schema}.classes
     WHERE id = $1 AND class_teacher_id = $2`,
    [classId, userId]
  );

  if (Number(result.rows[0]?.count ?? 0) > 0) {
    return true;
  }

  // Check if user is assigned to any subject in the class
  const subjectResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text as count
     FROM ${schema}.subject_teacher_assignments sta
     JOIN ${schema}.subjects s ON s.id = sta.subject_id
     JOIN ${schema}.classes c ON c.id = $1
     WHERE sta.teacher_user_id = $2 AND s.class_id = c.id`,
    [classId, userId]
  );

  return Number(subjectResult.rows[0]?.count ?? 0) > 0;
}

/**
 * Middleware to verify teacher or admin access
 * - If user has users:manage permission → allow
 * - Else if user has students:view_own_class → verify teacher assignment
 * - Else → deny
 */
export function verifyTeacherOrAdminAccess(options?: {
  classIdParam?: string; // Query param name for classId (default: 'classId')
  allowAdmins?: boolean; // Allow admins without verification (default: true)
}) {
  const { classIdParam = 'classId', allowAdmins = true } = options || {};

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.tenant || !req.tenantClient) {
      return res.status(401).json(createErrorResponse('Authentication required'));
    }

    // Get all user roles (primary + additional)
    const userRoles = getAllUserRoles(req.user as UserWithRoles);

    // Check if user has users:manage permission (admin)
    const hasManagePermission = userRoles.some((role) =>
      hasPermission(role as Role, 'users:manage')
    );

    if (hasManagePermission && allowAdmins) {
      return next(); // Admin access granted
    }

    // Check if user has students:view_own_class permission (teacher)
    const hasViewOwnClassPermission = userRoles.some((role) =>
      hasPermission(role as Role, 'students:view_own_class')
    );

    if (!hasViewOwnClassPermission) {
      return res
        .status(403)
        .json(
          createErrorResponse('Access denied. Required: users:manage or students:view_own_class')
        );
    }

    // For teachers, verify assignment to class
    const classId = (req.query[classIdParam] ||
      req.body[classIdParam] ||
      req.params[classIdParam]) as string;

    if (!classId) {
      // If no classId specified, allow access (teacher can view all students in their classes)
      // The service layer should filter by teacher's assigned classes
      return next();
    }

    // Verify teacher is assigned to this class
    const isAssigned = await verifyTeacherAssignment(
      req.user.id,
      classId,
      req.tenant.id,
      req.tenant.schema
    );

    if (!isAssigned) {
      return res
        .status(403)
        .json(createErrorResponse('Access denied. You are not assigned to this class.'));
    }

    next();
  };
}
