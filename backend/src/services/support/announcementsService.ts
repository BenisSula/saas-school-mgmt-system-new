import crypto from 'crypto';
import type { PoolClient } from 'pg';

export interface CreateAnnouncementInput {
  tenantId?: string;
  title: string;
  content: string;
  contentHtml?: string;
  type: 'info' | 'warning' | 'success' | 'error' | 'maintenance';
  priority?: 'low' | 'medium' | 'high';
  isPinned?: boolean;
  targetRoles?: string[];
  startDate?: Date;
  endDate?: Date;
  createdBy?: string;
}

export interface UpdateAnnouncementInput {
  title?: string;
  content?: string;
  contentHtml?: string;
  type?: 'info' | 'warning' | 'success' | 'error' | 'maintenance';
  priority?: 'low' | 'medium' | 'high';
  isPinned?: boolean;
  isActive?: boolean;
  targetRoles?: string[];
  startDate?: Date;
  endDate?: Date;
}

/**
 * Create announcement
 */
export async function createAnnouncement(
  client: PoolClient,
  input: CreateAnnouncementInput
): Promise<unknown> {
  const announcementId = crypto.randomUUID();

  const result = await client.query(
    `
      INSERT INTO shared.announcements (
        id, tenant_id, title, content, content_html, type,
        priority, is_pinned, target_roles, start_date, end_date, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `,
    [
      announcementId,
      input.tenantId || null,
      input.title,
      input.content,
      input.contentHtml || null,
      input.type,
      input.priority || 'medium',
      input.isPinned || false,
      input.targetRoles || [],
      input.startDate || null,
      input.endDate || null,
      input.createdBy || null,
    ]
  );

  return result.rows[0];
}

/**
 * Get announcements for user
 */
export async function getAnnouncementsForUser(
  client: PoolClient,
  userId: string,
  tenantId?: string,
  userRole?: string
): Promise<unknown[]> {
  const now = new Date();

  const conditions: string[] = [
    'is_active = TRUE',
    '(start_date IS NULL OR start_date <= $1)',
    '(end_date IS NULL OR end_date >= $1)',
  ];
  const values: unknown[] = [now];
  let paramIndex = 2;

  if (tenantId) {
    conditions.push(`(tenant_id = $${paramIndex++} OR tenant_id IS NULL)`);
    values.push(tenantId);
  }

  // Filter by role if specified
  if (userRole) {
    conditions.push(
      `(array_length(target_roles, 1) IS NULL OR $${paramIndex++} = ANY(target_roles))`
    );
    values.push(userRole);
  }

  const result = await client.query(
    `
      SELECT a.*,
             CASE WHEN av.id IS NOT NULL THEN TRUE ELSE FALSE END as is_viewed
      FROM shared.announcements a
      LEFT JOIN shared.announcement_views av ON av.announcement_id = a.id AND av.user_id = $${paramIndex++}
      WHERE ${conditions.join(' AND ')}
      ORDER BY is_pinned DESC, created_at DESC
    `,
    [...values, userId]
  );

  return result.rows;
}

/**
 * Mark announcement as viewed
 */
export async function markAnnouncementAsViewed(
  client: PoolClient,
  announcementId: string,
  userId: string
): Promise<void> {
  await client.query(
    `
      INSERT INTO shared.announcement_views (announcement_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (announcement_id, user_id) DO NOTHING
    `,
    [announcementId, userId]
  );
}

/**
 * Get all announcements (admin view)
 */
export async function getAllAnnouncements(
  client: PoolClient,
  tenantId?: string,
  filters?: {
    type?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<{ announcements: unknown[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (tenantId) {
    conditions.push(`(tenant_id = $${paramIndex++} OR tenant_id IS NULL)`);
    values.push(tenantId);
  }

  if (filters?.type) {
    conditions.push(`type = $${paramIndex++}`);
    values.push(filters.type);
  }

  if (filters?.isActive !== undefined) {
    conditions.push(`is_active = $${paramIndex++}`);
    values.push(filters.isActive);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await client.query(
    `SELECT COUNT(*) as total FROM shared.announcements ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get announcements
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;
  values.push(limit, offset);

  const announcementsResult = await client.query(
    `
      SELECT * FROM shared.announcements
      ${whereClause}
      ORDER BY is_pinned DESC, created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `,
    values
  );

  return {
    announcements: announcementsResult.rows,
    total,
  };
}

/**
 * Update announcement
 */
export async function updateAnnouncement(
  client: PoolClient,
  announcementId: string,
  input: UpdateAnnouncementInput
): Promise<unknown> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.title) {
    updates.push(`title = $${paramIndex++}`);
    values.push(input.title);
  }

  if (input.content) {
    updates.push(`content = $${paramIndex++}`);
    values.push(input.content);
  }

  if (input.contentHtml !== undefined) {
    updates.push(`content_html = $${paramIndex++}`);
    values.push(input.contentHtml);
  }

  if (input.type) {
    updates.push(`type = $${paramIndex++}`);
    values.push(input.type);
  }

  if (input.priority) {
    updates.push(`priority = $${paramIndex++}`);
    values.push(input.priority);
  }

  if (input.isPinned !== undefined) {
    updates.push(`is_pinned = $${paramIndex++}`);
    values.push(input.isPinned);
  }

  if (input.isActive !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(input.isActive);
  }

  if (input.targetRoles !== undefined) {
    updates.push(`target_roles = $${paramIndex++}`);
    values.push(input.targetRoles);
  }

  if (input.startDate !== undefined) {
    updates.push(`start_date = $${paramIndex++}`);
    values.push(input.startDate);
  }

  if (input.endDate !== undefined) {
    updates.push(`end_date = $${paramIndex++}`);
    values.push(input.endDate);
  }

  if (updates.length === 0) {
    throw new Error('No updates provided');
  }

  updates.push(`updated_at = NOW()`);
  values.push(announcementId);

  const result = await client.query(
    `
      UPDATE shared.announcements
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `,
    values
  );

  return result.rows[0];
}

/**
 * Delete announcement
 */
export async function deleteAnnouncement(
  client: PoolClient,
  announcementId: string,
  tenantId?: string
): Promise<void> {
  const conditions: string[] = ['id = $1'];
  const values: unknown[] = [announcementId];
  let paramIndex = 2;

  if (tenantId) {
    conditions.push(`(tenant_id = $${paramIndex++} OR tenant_id IS NULL)`);
    values.push(tenantId);
  }

  const result = await client.query(
    `DELETE FROM shared.announcements WHERE ${conditions.join(' AND ')}`,
    values
  );

  if (result.rowCount === 0) {
    throw new Error('Announcement not found');
  }
}
