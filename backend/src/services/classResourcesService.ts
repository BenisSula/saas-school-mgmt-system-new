/**
 * Class Resources Service
 * Handles class resource uploads and management
 */

import type { PoolClient } from 'pg';
import { assertValidSchemaName } from '../db/tenantManager';
import { checkTeacherAssignment } from '../middleware/verifyTeacherAssignment';
import { createAuditLog } from './audit/enhancedAuditService';
import { uploadFile } from './fileUploadService';

export interface ClassResourceInput {
  classId: string;
  title: string;
  description?: string;
  file: {
    filename: string;
    mimetype: string;
    size: number;
    data: Buffer;
  };
}

export interface ClassResource {
  id: string;
  tenant_id: string;
  teacher_id: string;
  class_id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string;
  size: number;
  created_at: Date;
}

/**
 * Upload a class resource (teacher-scoped)
 */
export async function uploadClassResource(
  client: PoolClient,
  schema: string,
  tenantId: string,
  teacherId: string,
  input: ClassResourceInput,
  actorId: string
): Promise<ClassResource> {
  assertValidSchemaName(schema);

  // Verify teacher is assigned to the class
  const isAssigned = await checkTeacherAssignment(client, schema, teacherId, input.classId);
  if (!isAssigned) {
    throw new Error('Teacher is not assigned to this class');
  }

  // Upload file
  const uploadResult = await uploadFile({
    file: input.file,
    userId: actorId,
    tenantId,
    description: input.description,
    entityType: 'teacher',
    entityId: teacherId,
  });

  // Save resource metadata
  const result = await client.query<ClassResource>(
    `
      INSERT INTO ${schema}.class_resources (
        tenant_id, teacher_id, class_id, title, description, file_url, file_type, size
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      tenantId,
      teacherId,
      input.classId,
      input.title,
      input.description || null,
      uploadResult.fileUrl,
      uploadResult.mimeType,
      uploadResult.fileSize,
    ]
  );

  const resource = result.rows[0];

  // Create audit log
  try {
    await createAuditLog(client, {
      tenantId,
      userId: actorId,
      action: 'TEACHER_UPLOADED_RESOURCE',
      resourceType: 'resource',
      resourceId: resource.id,
      details: {
        teacherId,
        classId: input.classId,
        title: input.title,
        fileType: uploadResult.mimeType,
      },
      severity: 'info',
    });
  } catch (auditError) {
    console.error('[classResourcesService] Failed to create audit log:', auditError);
  }

  return resource;
}

/**
 * Get class resources (teacher or student-scoped)
 */
export async function getClassResources(
  client: PoolClient,
  schema: string,
  classId: string,
  teacherId?: string
): Promise<ClassResource[]> {
  assertValidSchemaName(schema);

  const params: unknown[] = [classId];
  let query = `
    SELECT * FROM ${schema}.class_resources
    WHERE class_id = $1
  `;

  // If teacherId provided, verify assignment
  if (teacherId) {
    const isAssigned = await checkTeacherAssignment(client, schema, teacherId, classId);
    if (!isAssigned) {
      throw new Error('Teacher is not assigned to this class');
    }
    query += ` AND teacher_id = $2`;
    params.push(teacherId);
  }

  query += ` ORDER BY created_at DESC`;

  const result = await client.query<ClassResource>(query, params);
  return result.rows;
}

/**
 * Delete a class resource (teacher-scoped)
 */
export async function deleteClassResource(
  client: PoolClient,
  schema: string,
  teacherId: string,
  resourceId: string,
  actorId: string
): Promise<boolean> {
  assertValidSchemaName(schema);

  // Get resource to verify ownership and class assignment
  const resourceCheck = await client.query<{ class_id: string; teacher_id: string }>(
    `SELECT class_id, teacher_id FROM ${schema}.class_resources WHERE id = $1`,
    [resourceId]
  );

  if (resourceCheck.rows.length === 0) {
    return false;
  }

  const resource = resourceCheck.rows[0];

  // Verify teacher owns the resource
  if (resource.teacher_id !== teacherId) {
    throw new Error('You do not have permission to delete this resource');
  }

  // Verify teacher is still assigned to the class
  const isAssigned = await checkTeacherAssignment(client, schema, teacherId, resource.class_id);
  if (!isAssigned) {
    throw new Error('Teacher is not assigned to this class');
  }

  // Delete resource
  await client.query(`DELETE FROM ${schema}.class_resources WHERE id = $1`, [resourceId]);

  // Create audit log
  try {
    await createAuditLog(client, {
      tenantId: undefined,
      userId: actorId,
      action: 'TEACHER_DELETED_RESOURCE',
      resourceType: 'resource',
      resourceId,
      details: {
        teacherId,
        classId: resource.class_id,
      },
      severity: 'info',
    });
  } catch (auditError) {
    console.error('[classResourcesService] Failed to create audit log:', auditError);
  }

  return true;
}
