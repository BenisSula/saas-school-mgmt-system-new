/**
 * Teacher Announcements Service
 * Handles teacher-to-student announcements
 */

import type { PoolClient } from 'pg';
import { assertValidSchemaName } from '../db/tenantManager';
import { checkTeacherAssignment } from '../middleware/verifyTeacherAssignment';
import { createAuditLog } from './audit/enhancedAuditService';

export interface ClassAnnouncementInput {
  classId: string;
  message: string;
  attachments?: Array<{ filename: string; url: string }>;
}

export interface ClassAnnouncement {
  id: string;
  tenant_id: string;
  class_id: string;
  teacher_id: string;
  message: string;
  attachments: Array<{ filename: string; url: string }> | null;
  created_at: Date;
  teacher_name?: string;
}

/**
 * Post an announcement to a class (teacher-scoped)
 */
export async function postClassAnnouncement(
  client: PoolClient,
  schema: string,
  tenantId: string,
  teacherId: string,
  input: ClassAnnouncementInput,
  actorId: string
): Promise<ClassAnnouncement> {
  assertValidSchemaName(schema);

  // Verify teacher is assigned to the class
  const isAssigned = await checkTeacherAssignment(client, schema, teacherId, input.classId);
  if (!isAssigned) {
    throw new Error('Teacher is not assigned to this class');
  }

  // Insert announcement
  const result = await client.query<ClassAnnouncement>(
    `
      INSERT INTO ${schema}.class_announcements (
        tenant_id, class_id, teacher_id, message, attachments
      )
      VALUES ($1, $2, $3, $4, $5::jsonb)
      RETURNING *
    `,
    [
      tenantId,
      input.classId,
      teacherId,
      input.message,
      JSON.stringify(input.attachments || [])
    ]
  );

  const announcement = result.rows[0];

  // Create audit log
  try {
    await createAuditLog(client, {
      tenantId,
      userId: actorId,
      action: 'TEACHER_POSTED_ANNOUNCEMENT',
      resourceType: 'announcement',
      resourceId: announcement.id,
      details: {
        teacherId,
        classId: input.classId,
        messageLength: input.message.length
      },
      severity: 'info'
    });
  } catch (auditError) {
    console.error('[teacherAnnouncementsService] Failed to create audit log:', auditError);
  }

  return announcement;
}

/**
 * Get announcements for a class (student or teacher-scoped)
 */
export async function getClassAnnouncements(
  client: PoolClient,
  schema: string,
  classId: string,
  limit: number = 50
): Promise<ClassAnnouncement[]> {
  assertValidSchemaName(schema);

  const result = await client.query<ClassAnnouncement>(
    `
      SELECT 
        ca.*,
        t.name as teacher_name
      FROM ${schema}.class_announcements ca
      LEFT JOIN ${schema}.teachers t ON ca.teacher_id = t.id
      WHERE ca.class_id = $1
      ORDER BY ca.created_at DESC
      LIMIT $2
    `,
    [classId, limit]
  );

  return result.rows.map((row) => ({
    ...row,
    attachments: row.attachments ? (typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments) : null
  }));
}

