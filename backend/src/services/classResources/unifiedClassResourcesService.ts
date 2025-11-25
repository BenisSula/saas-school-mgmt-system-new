/**
 * Unified Class Resources Service
 *
 * Consolidates teacher-scoped and admin-scoped class resources into a single service.
 * Supports both file uploads (teacher) and URL-based resources (admin).
 */

import type { PoolClient } from 'pg';
import { assertValidSchemaName } from '../../db/tenantManager';
import { checkTeacherAssignment } from '../../middleware/verifyTeacherAssignment';
import { createAuditLog } from '../audit/enhancedAuditService';
import { uploadFile } from '../fileUploadService';

/**
 * Unified Class Resource interface
 * Supports both old (teacher-scoped) and new (admin-scoped) formats
 */
export interface UnifiedClassResource {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  resource_type: 'document' | 'link' | 'file' | 'video';
  resource_url: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  // Legacy fields (for backward compatibility)
  tenant_id?: string | null;
  teacher_id?: string | null;
  // New fields
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Input for creating a class resource (admin-scoped)
 */
export interface CreateClassResourceInput {
  class_id: string;
  title: string;
  description?: string;
  resource_type: 'document' | 'link' | 'file' | 'video';
  resource_url: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
}

/**
 * Input for uploading a class resource (teacher-scoped)
 */
export interface UploadClassResourceInput {
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

/**
 * Filters for listing class resources
 */
export interface ClassResourceFilters {
  classId?: string;
  resourceType?: string;
  teacherId?: string;
  search?: string;
}

/**
 * List class resources with optional filters
 * Supports both teacher-scoped and admin-scoped queries
 */
export async function listClassResources(
  client: PoolClient,
  schema: string,
  filters?: ClassResourceFilters,
  pagination?: { limit: number; offset: number }
): Promise<UnifiedClassResource[]> {
  assertValidSchemaName(schema);

  let query = `SELECT * FROM ${schema}.class_resources WHERE 1=1`;
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters?.classId) {
    query += ` AND class_id = $${paramIndex++}`;
    params.push(filters.classId);
  }

  if (filters?.resourceType) {
    query += ` AND resource_type = $${paramIndex++}`;
    params.push(filters.resourceType);
  }

  if (filters?.teacherId) {
    query += ` AND teacher_id = $${paramIndex++}`;
    params.push(filters.teacherId);
  }

  if (filters?.search) {
    query += ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  params.push(pagination?.limit || 50, pagination?.offset || 0);

  const result = await client.query<UnifiedClassResource>(query, params);
  return result.rows;
}

/**
 * Get class resources for a specific class (backward compatibility)
 * Supports teacher-scoped filtering
 */
export async function getClassResources(
  client: PoolClient,
  schema: string,
  classId: string,
  teacherId?: string
): Promise<UnifiedClassResource[]> {
  assertValidSchemaName(schema);

  const params: unknown[] = [classId];
  let query = `
    SELECT * FROM ${schema}.class_resources
    WHERE class_id = $1
  `;

  // If teacherId provided, verify assignment and filter
  if (teacherId) {
    const isAssigned = await checkTeacherAssignment(client, schema, teacherId, classId);
    if (!isAssigned) {
      throw new Error('Teacher is not assigned to this class');
    }
    query += ` AND (teacher_id = $2 OR teacher_id IS NULL)`;
    params.push(teacherId);
  }

  query += ` ORDER BY created_at DESC`;

  const result = await client.query<UnifiedClassResource>(query, params);
  return result.rows;
}

/**
 * Get a single class resource by ID
 */
export async function getClassResource(
  client: PoolClient,
  schema: string,
  id: string
): Promise<UnifiedClassResource | null> {
  assertValidSchemaName(schema);

  const result = await client.query<UnifiedClassResource>(
    `SELECT * FROM ${schema}.class_resources WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Create a class resource (admin-scoped)
 * For URL-based resources (links, videos, etc.)
 */
export async function createClassResource(
  client: PoolClient,
  schema: string,
  input: CreateClassResourceInput,
  actorId: string,
  tenantId?: string
): Promise<UnifiedClassResource> {
  assertValidSchemaName(schema);

  const result = await client.query<UnifiedClassResource>(
    `INSERT INTO ${schema}.class_resources 
     (class_id, title, description, resource_type, resource_url, file_name, file_size, mime_type, 
      tenant_id, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
     RETURNING *`,
    [
      input.class_id,
      input.title,
      input.description || null,
      input.resource_type,
      input.resource_url,
      input.file_name || null,
      input.file_size || null,
      input.mime_type || null,
      tenantId || null,
      actorId,
    ]
  );

  const item = result.rows[0];

  // Create audit log
  await createAuditLog(client, {
    tenantId: tenantId ?? undefined,
    userId: actorId,
    action: 'CLASS_RESOURCE_CREATED',
    resourceType: 'class_resource',
    resourceId: item.id,
    details: { title: item.title, class_id: item.class_id, resource_type: item.resource_type },
    severity: 'info',
  });

  return item;
}

/**
 * Upload a class resource (teacher-scoped)
 * For file uploads with teacher assignment verification
 */
export async function uploadClassResource(
  client: PoolClient,
  schema: string,
  tenantId: string,
  teacherId: string,
  input: UploadClassResourceInput,
  actorId: string
): Promise<UnifiedClassResource> {
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

  // Determine resource type from mime type
  const resourceType = uploadResult.mimeType.startsWith('video/')
    ? 'video'
    : uploadResult.mimeType.startsWith('image/')
      ? 'file'
      : 'document';

  // Save resource metadata with unified schema
  const result = await client.query<UnifiedClassResource>(
    `
      INSERT INTO ${schema}.class_resources (
        tenant_id, teacher_id, class_id, title, description, 
        resource_type, resource_url, file_name, file_size, mime_type,
        created_by, updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
      RETURNING *
    `,
    [
      tenantId,
      teacherId,
      input.classId,
      input.title,
      input.description || null,
      resourceType,
      uploadResult.fileUrl,
      input.file.filename,
      uploadResult.fileSize,
      uploadResult.mimeType,
      actorId,
    ]
  );

  const resource = result.rows[0];

  // Create audit log
  try {
    await createAuditLog(client, {
      tenantId,
      userId: actorId,
      action: 'TEACHER_UPLOADED_RESOURCE',
      resourceType: 'class_resource',
      resourceId: resource.id,
      details: {
        teacherId,
        classId: input.classId,
        title: input.title,
        resourceType,
        fileType: uploadResult.mimeType,
      },
      severity: 'info',
    });
  } catch (auditError) {
    console.error('[unifiedClassResourcesService] Failed to create audit log:', auditError);
  }

  return resource;
}

/**
 * Update class resource
 */
export async function updateClassResource(
  client: PoolClient,
  schema: string,
  id: string,
  input: Partial<CreateClassResourceInput>,
  actorId: string
): Promise<UnifiedClassResource | null> {
  assertValidSchemaName(schema);

  const updates: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (input.title !== undefined) {
    updates.push(`title = $${paramIndex++}`);
    params.push(input.title);
  }
  if (input.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    params.push(input.description);
  }
  if (input.resource_type !== undefined) {
    updates.push(`resource_type = $${paramIndex++}`);
    params.push(input.resource_type);
  }
  if (input.resource_url !== undefined) {
    updates.push(`resource_url = $${paramIndex++}`);
    params.push(input.resource_url);
  }
  if (input.file_name !== undefined) {
    updates.push(`file_name = $${paramIndex++}`);
    params.push(input.file_name);
  }
  if (input.file_size !== undefined) {
    updates.push(`file_size = $${paramIndex++}`);
    params.push(input.file_size);
  }
  if (input.mime_type !== undefined) {
    updates.push(`mime_type = $${paramIndex++}`);
    params.push(input.mime_type);
  }

  if (updates.length === 0) {
    return getClassResource(client, schema, id);
  }

  updates.push(`updated_by = $${paramIndex++}`);
  params.push(actorId);
  updates.push(`updated_at = NOW()`);
  params.push(id);

  const result = await client.query<UnifiedClassResource>(
    `UPDATE ${schema}.class_resources
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    params
  );

  if (result.rows.length === 0) {
    return null;
  }

  const item = result.rows[0];

  // Create audit log
  await createAuditLog(client, {
    tenantId: undefined, // tenantId not available in update context
    userId: actorId,
    action: 'CLASS_RESOURCE_UPDATED',
    resourceType: 'class_resource',
    resourceId: item.id,
    details: { title: item.title },
    severity: 'info',
  });

  return item;
}

/**
 * Delete a class resource
 * Supports both teacher-scoped (ownership verification) and admin-scoped deletion
 */
export async function deleteClassResource(
  client: PoolClient,
  schema: string,
  resourceId: string,
  actorId: string,
  teacherId?: string
): Promise<boolean> {
  assertValidSchemaName(schema);

  // Get resource to verify ownership if teacher-scoped
  if (teacherId) {
    const resourceCheck = await client.query<{
      class_id: string;
      teacher_id: string | null;
    }>(`SELECT class_id, teacher_id FROM ${schema}.class_resources WHERE id = $1`, [resourceId]);

    if (resourceCheck.rows.length === 0) {
      return false;
    }

    const resource = resourceCheck.rows[0];

    // Verify teacher owns the resource (if it's teacher-scoped)
    if (resource.teacher_id && resource.teacher_id !== teacherId) {
      throw new Error('You do not have permission to delete this resource');
    }

    // Verify teacher is still assigned to the class
    const isAssigned = await checkTeacherAssignment(client, schema, teacherId, resource.class_id);
    if (!isAssigned) {
      throw new Error('Teacher is not assigned to this class');
    }
  }

  // Delete resource
  const result = await client.query(`DELETE FROM ${schema}.class_resources WHERE id = $1`, [
    resourceId,
  ]);

  if (result.rowCount === 0) {
    return false;
  }

  // Create audit log
  try {
    await createAuditLog(client, {
      tenantId: undefined,
      userId: actorId,
      action: teacherId ? 'TEACHER_DELETED_RESOURCE' : 'CLASS_RESOURCE_DELETED',
      resourceType: 'class_resource',
      resourceId,
      details: {
        teacherId: teacherId || null,
      },
      severity: 'info',
    });
  } catch (auditError) {
    console.error('[unifiedClassResourcesService] Failed to create audit log:', auditError);
  }

  return true;
}
