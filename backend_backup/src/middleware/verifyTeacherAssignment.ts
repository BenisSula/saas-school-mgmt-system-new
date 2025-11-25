import { Request, Response, NextFunction } from 'express';
import { PoolClient } from 'pg';
import { getPool } from '../db/connection';
import { logUnauthorizedAttempt } from '../services/auditLogService';
import { FRIENDLY_FORBIDDEN_MESSAGE } from '../lib/friendlyMessages';
import type { TeacherRecord } from '../services/teacherDashboardService';

/**
 * Options for verifying teacher assignment
 */
export interface VerifyTeacherAssignmentOptions {
  /**
   * Name of the parameter that contains the classId (e.g., 'classId', 'class_id')
   * If not provided, will look for 'classId' in req.params or req.body
   */
  classIdParam?: string;
  /**
   * Name of the parameter that contains the subjectId (e.g., 'subjectId', 'subject_id')
   * If not provided, will look for 'subjectId' in req.params or req.body
   */
  subjectIdParam?: string;
  /**
   * Whether to require both classId and subjectId, or just one
   * Default: false (only classId required)
   */
  requireSubject?: boolean;
  /**
   * Whether to allow admins/superadmins to bypass the check
   * Default: true
   */
  allowAdmins?: boolean;
}

/**
 * Verifies that a teacher is assigned to the specified class/subject.
 * This middleware should be used after authenticate, tenantResolver, and ensureTenantContext.
 *
 * Usage:
 * router.post('/attendance/:classId', verifyTeacherAssignment({ classIdParam: 'classId' }), ...)
 */
export function verifyTeacherAssignment(options: VerifyTeacherAssignmentOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Allow admins/superadmins to bypass if configured
      if (
        options.allowAdmins !== false &&
        (req.user?.role === 'admin' || req.user?.role === 'superadmin')
      ) {
        return next();
      }

      // Must be a teacher
      if (req.user?.role !== 'teacher') {
        return res.status(403).json({ message: FRIENDLY_FORBIDDEN_MESSAGE });
      }

      if (!req.tenantClient || !req.tenant || !req.user?.id) {
        return res.status(500).json({ message: 'Tenant context or user missing' });
      }

      // Extract classId and subjectId from params or body
      const classIdParam = options.classIdParam ?? 'classId';
      const subjectIdParam = options.subjectIdParam ?? 'subjectId';

      const classId = (req.params?.[classIdParam] ||
        req.body?.[classIdParam] ||
        req.query?.[classIdParam]) as string | undefined;
      const subjectId = (req.params?.[subjectIdParam] ||
        req.body?.[subjectIdParam] ||
        req.query?.[subjectIdParam]) as string | undefined;

      if (!classId && !subjectId) {
        return res.status(400).json({ message: 'classId or subjectId is required' });
      }

      if (options.requireSubject && !subjectId) {
        return res.status(400).json({ message: 'subjectId is required' });
      }

      // Use req.teacherRecord if available (set by route middleware)
      // Otherwise, look up the teacher by email
      let teacherId: string;
      interface RequestWithTeacherRecord extends Request {
        teacherRecord?: TeacherRecord;
      }
      const teacherRecord = (req as RequestWithTeacherRecord).teacherRecord;
      if (teacherRecord?.id) {
        teacherId = teacherRecord.id;
      } else {
        try {
          const mainPool = getPool();
          const userResult = await mainPool.query(`SELECT email FROM shared.users WHERE id = $1`, [
            req.user.id
          ]);
          const userEmail = userResult.rows[0]?.email;
          if (!userEmail) {
            return res.status(403).json({
              message: 'Teacher profile not found. Please contact an administrator.'
            });
          }

          const teacherResult = await req.tenantClient.query(
            `SELECT id FROM ${req.tenant.schema}.teachers WHERE email = $1`,
            [userEmail]
          );
          teacherId = teacherResult.rows[0]?.id;

          if (!teacherId) {
            return res.status(403).json({
              message: 'Teacher profile not found. Please contact an administrator.'
            });
          }
        } catch (error) {
          console.error('Error in verifyTeacherAssignment middleware:', error);
          return res.status(500).json({
            message: 'Failed to verify teacher assignment',
            error: (error as Error).message
          });
        }
      }

      // Verify teacher assignment
      try {
        const isAssigned = await checkTeacherAssignment(
          req.tenantClient,
          req.tenant.schema,
          teacherId,
          classId,
          subjectId
        );

        if (!isAssigned) {
          await logUnauthorizedAttempt(req.tenantClient, req.tenant.schema, {
            userId: req.user.id,
            path: req.originalUrl ?? req.path,
            method: req.method,
            reason: 'Teacher not assigned to class/subject',
            details: { classId, subjectId }
          });
          return res.status(403).json({
            message:
              'You are not assigned to this class or subject. Thank you for your understanding.'
          });
        }

        next();
      } catch (checkError) {
        console.error('Error in checkTeacherAssignment:', checkError);
        if (!res.headersSent) {
          return res.status(500).json({
            message: 'Failed to verify teacher assignment',
            error: (checkError as Error).message
          });
        }
        next(checkError);
      }
    } catch (error) {
      console.error('Error in verifyTeacherAssignment middleware:', error);
      if (!res.headersSent) {
        return res.status(500).json({
          message: 'Failed to verify teacher assignment',
          error: (error as Error).message
        });
      }
      next(error);
    }
  };
}

/**
 * Service-level function to verify teacher assignment.
 * Can be used in services as an additional check.
 */
export async function checkTeacherAssignment(
  client: PoolClient,
  schema: string,
  teacherId: string,
  classId?: string,
  subjectId?: string
): Promise<boolean> {
  if (!classId && !subjectId) {
    return false;
  }

  let query = `
    SELECT COUNT(*) as count
    FROM ${schema}.teacher_assignments
    WHERE teacher_id = $1
  `;
  const params: unknown[] = [teacherId];
  let paramIndex = 2;

  if (classId) {
    // Handle both UUID and TEXT class_id types
    query += ` AND class_id::text = $${paramIndex}::text`;
    params.push(classId);
    paramIndex++;
  }

  if (subjectId) {
    query += ` AND subject_id = $${paramIndex}`;
    params.push(subjectId);
    paramIndex++;
  }

  const result = await client.query(query, params);
  return (result.rows[0]?.count ?? 0) > 0;
}

export default verifyTeacherAssignment;
