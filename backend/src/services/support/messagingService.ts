import crypto from 'crypto';
import type { PoolClient } from 'pg';

export interface CreateMessageInput {
  tenantId?: string;
  senderId: string;
  recipientId?: string;
  recipientRole?: string;
  subject: string;
  content: string;
  contentHtml?: string;
  messageType: 'direct' | 'broadcast' | 'system';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  attachments?: Array<{ fileName: string; fileUrl: string; fileSize: number; mimeType: string }>;
  metadata?: Record<string, unknown>;
}

export interface UpdateMessageInput {
  isRead?: boolean;
  isArchived?: boolean;
}

/**
 * Create message
 */
export async function createMessage(
  client: PoolClient,
  input: CreateMessageInput
): Promise<unknown> {
  const messageId = crypto.randomUUID();

  // If broadcast or system message, create for all recipients
  if (input.messageType === 'broadcast' && input.recipientRole) {
    // Get all users with the role
    const usersResult = await client.query(
      `
        SELECT id FROM shared.users
        WHERE ($1::uuid IS NULL OR tenant_id = $1)
          AND role = $2
          AND id != $3
      `,
      [input.tenantId || null, input.recipientRole, input.senderId]
    );

    const messages: unknown[] = [];

    for (const user of usersResult.rows) {
      const msgId = crypto.randomUUID();
      const msgResult = await client.query(
        `
          INSERT INTO shared.messages (
            id, tenant_id, sender_id, recipient_id, recipient_role,
            subject, content, content_html, message_type, priority,
            attachments, metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING *
        `,
        [
          msgId,
          input.tenantId || null,
          input.senderId,
          user.id,
          input.recipientRole,
          input.subject,
          input.content,
          input.contentHtml || null,
          input.messageType,
          input.priority || 'normal',
          JSON.stringify(input.attachments || []),
          JSON.stringify(input.metadata || {}),
        ]
      );
      messages.push(msgResult.rows[0]);
    }

    return { messages, count: messages.length };
  }

  // Direct message
  const result = await client.query(
    `
      INSERT INTO shared.messages (
        id, tenant_id, sender_id, recipient_id, recipient_role,
        subject, content, content_html, message_type, priority,
        attachments, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `,
    [
      messageId,
      input.tenantId || null,
      input.senderId,
      input.recipientId || null,
      input.recipientRole || null,
      input.subject,
      input.content,
      input.contentHtml || null,
      input.messageType,
      input.priority || 'normal',
      JSON.stringify(input.attachments || []),
      JSON.stringify(input.metadata || {}),
    ]
  );

  return result.rows[0];
}

/**
 * Get messages for user
 */
export async function getUserMessages(
  client: PoolClient,
  userId: string,
  tenantId?: string,
  filters?: {
    isRead?: boolean;
    isArchived?: boolean;
    messageType?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ messages: unknown[]; total: number; unreadCount: number }> {
  const conditions: string[] = [
    `(recipient_id = $1 OR (recipient_role IS NOT NULL AND recipient_role = (SELECT role FROM shared.users WHERE id = $1)))`,
  ];
  const values: unknown[] = [userId];
  let paramIndex = 2;

  if (tenantId) {
    conditions.push(`(tenant_id = $${paramIndex++} OR tenant_id IS NULL)`);
    values.push(tenantId);
  }

  if (filters?.isRead !== undefined) {
    conditions.push(`is_read = $${paramIndex++}`);
    values.push(filters.isRead);
  }

  if (filters?.isArchived !== undefined) {
    conditions.push(`is_archived = $${paramIndex++}`);
    values.push(filters.isArchived);
  }

  if (filters?.messageType) {
    conditions.push(`message_type = $${paramIndex++}`);
    values.push(filters.messageType);
  }

  if (filters?.priority) {
    conditions.push(`priority = $${paramIndex++}`);
    values.push(filters.priority);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await client.query(
    `SELECT COUNT(*) as total FROM shared.messages ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get unread count
  const unreadConditions = [...conditions];
  const unreadValues = [...values];
  // unreadParamIndex not used but kept for consistency with similar patterns
  // let unreadParamIndex = paramIndex;
  unreadConditions.push(`is_read = FALSE`);
  const unreadCountResult = await client.query(
    `SELECT COUNT(*) as count FROM shared.messages WHERE ${unreadConditions.join(' AND ')}`,
    unreadValues
  );
  const unreadCount = parseInt(unreadCountResult.rows[0].count, 10);

  // Get messages
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;
  values.push(limit, offset);

  const messagesResult = await client.query(
    `
      SELECT m.*,
             u1.email as sender_email,
             u2.email as recipient_email
      FROM shared.messages m
      LEFT JOIN shared.users u1 ON u1.id = m.sender_id
      LEFT JOIN shared.users u2 ON u2.id = m.recipient_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `,
    values
  );

  return {
    messages: messagesResult.rows,
    total,
    unreadCount,
  };
}

/**
 * Mark message as read
 */
export async function markMessageAsRead(
  client: PoolClient,
  messageId: string,
  userId: string
): Promise<void> {
  await client.query(
    `
      UPDATE shared.messages
      SET is_read = TRUE,
          read_at = NOW(),
          updated_at = NOW()
      WHERE id = $1 AND recipient_id = $2
    `,
    [messageId, userId]
  );
}

/**
 * Archive message
 */
export async function archiveMessage(
  client: PoolClient,
  messageId: string,
  userId: string
): Promise<void> {
  await client.query(
    `
      UPDATE shared.messages
      SET is_archived = TRUE,
          archived_at = NOW(),
          updated_at = NOW()
      WHERE id = $1 AND recipient_id = $2
    `,
    [messageId, userId]
  );
}

/**
 * Get message thread (conversation)
 */
export async function getMessageThread(
  client: PoolClient,
  threadId: string,
  userId: string
): Promise<unknown | null> {
  const threadResult = await client.query(
    `
      SELECT * FROM shared.message_threads
      WHERE id = $1 AND $2 = ANY(participants)
    `,
    [threadId, userId]
  );

  if (threadResult.rowCount === 0) {
    return null;
  }

  const thread = threadResult.rows[0];

  // Get messages in thread
  const messagesResult = await client.query(
    `
      SELECT m.*,
             u1.email as sender_email,
             u2.email as recipient_email
      FROM shared.messages m
      LEFT JOIN shared.users u1 ON u1.id = m.sender_id
      LEFT JOIN shared.users u2 ON u2.id = m.recipient_id
      WHERE m.tenant_id = $1
        AND (
          (m.sender_id = ANY($2::uuid[]) AND m.recipient_id = ANY($2::uuid[]))
          OR m.message_type = 'broadcast'
        )
      ORDER BY m.created_at ASC
    `,
    [thread.tenant_id, thread.participants]
  );

  return {
    ...thread,
    messages: messagesResult.rows,
  };
}
