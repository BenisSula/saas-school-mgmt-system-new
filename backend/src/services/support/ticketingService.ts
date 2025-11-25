import crypto from 'crypto';
import type { PoolClient } from 'pg';
// z from zod not used in this file but may be needed for future implementations

export interface CreateTicketInput {
  tenantId?: string;
  subject: string;
  description: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: 'technical' | 'billing' | 'feature_request' | 'bug' | 'other';
  createdBy: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateTicketInput {
  subject?: string;
  description?: string;
  status?: 'open' | 'in_progress' | 'resolved' | 'closed' | 'pending';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: 'technical' | 'billing' | 'feature_request' | 'bug' | 'other';
  assignedTo?: string | null;
}

export interface CreateTicketCommentInput {
  ticketId: string;
  userId: string;
  content: string;
  isInternal?: boolean;
  attachments?: Array<{ fileName: string; fileUrl: string; fileSize: number; mimeType: string }>;
}

/**
 * Generate unique ticket number
 */
async function generateTicketNumber(client: PoolClient): Promise<string> {
  const result = await client.query('SELECT generate_ticket_number() as ticket_number');
  return result.rows[0].ticket_number;
}

/**
 * Create support ticket
 */
export async function createTicket(client: PoolClient, input: CreateTicketInput): Promise<unknown> {
  const ticketId = crypto.randomUUID();
  const ticketNumber = await generateTicketNumber(client);

  const result = await client.query(
    `
      INSERT INTO shared.support_tickets (
        id, tenant_id, ticket_number, subject, description,
        status, priority, category, created_by, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `,
    [
      ticketId,
      input.tenantId || null,
      ticketNumber,
      input.subject,
      input.description,
      'open',
      input.priority || 'medium',
      input.category || 'other',
      input.createdBy,
      JSON.stringify(input.metadata || {}),
    ]
  );

  return result.rows[0];
}

/**
 * Get ticket by ID
 */
export async function getTicket(
  client: PoolClient,
  ticketId: string,
  tenantId?: string
): Promise<unknown | null> {
  const conditions: string[] = ['id = $1'];
  const values: unknown[] = [ticketId];
  let paramIndex = 2;

  if (tenantId) {
    conditions.push(`(tenant_id = $${paramIndex++} OR tenant_id IS NULL)`);
    values.push(tenantId);
  }

  const result = await client.query(
    `
      SELECT * FROM shared.support_tickets
      WHERE ${conditions.join(' AND ')}
    `,
    values
  );

  return result.rows[0] || null;
}

/**
 * Get tickets with filters
 */
export async function getTickets(
  client: PoolClient,
  filters: {
    tenantId?: string;
    status?: string;
    priority?: string;
    category?: string;
    createdBy?: string;
    assignedTo?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ tickets: unknown[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.tenantId) {
    conditions.push(`(tenant_id = $${paramIndex++} OR tenant_id IS NULL)`);
    values.push(filters.tenantId);
  }

  if (filters.status) {
    conditions.push(`status = $${paramIndex++}`);
    values.push(filters.status);
  }

  if (filters.priority) {
    conditions.push(`priority = $${paramIndex++}`);
    values.push(filters.priority);
  }

  if (filters.category) {
    conditions.push(`category = $${paramIndex++}`);
    values.push(filters.category);
  }

  if (filters.createdBy) {
    conditions.push(`created_by = $${paramIndex++}`);
    values.push(filters.createdBy);
  }

  if (filters.assignedTo) {
    conditions.push(`assigned_to = $${paramIndex++}`);
    values.push(filters.assignedTo);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await client.query(
    `SELECT COUNT(*) as total FROM shared.support_tickets ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get tickets
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  values.push(limit, offset);

  const ticketsResult = await client.query(
    `
      SELECT * FROM shared.support_tickets
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `,
    values
  );

  return {
    tickets: ticketsResult.rows,
    total,
  };
}

/**
 * Update ticket
 */
export async function updateTicket(
  client: PoolClient,
  ticketId: string,
  input: UpdateTicketInput,
  actorId?: string
): Promise<unknown> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.subject) {
    updates.push(`subject = $${paramIndex++}`);
    values.push(input.subject);
  }

  if (input.description) {
    updates.push(`description = $${paramIndex++}`);
    values.push(input.description);
  }

  if (input.status) {
    updates.push(`status = $${paramIndex++}`);
    values.push(input.status);

    if (input.status === 'resolved') {
      updates.push(`resolved_at = NOW()`);
      updates.push(`resolved_by = $${paramIndex++}`);
      values.push(actorId || null);
    }

    if (input.status === 'closed') {
      updates.push(`closed_at = NOW()`);
    }
  }

  if (input.priority) {
    updates.push(`priority = $${paramIndex++}`);
    values.push(input.priority);
  }

  if (input.category) {
    updates.push(`category = $${paramIndex++}`);
    values.push(input.category);
  }

  if (input.assignedTo !== undefined) {
    updates.push(`assigned_to = $${paramIndex++}`);
    values.push(input.assignedTo);
  }

  if (updates.length === 0) {
    throw new Error('No updates provided');
  }

  updates.push(`updated_at = NOW()`);
  values.push(ticketId);

  const result = await client.query(
    `
      UPDATE shared.support_tickets
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `,
    values
  );

  return result.rows[0];
}

/**
 * Add comment to ticket
 */
export async function addTicketComment(
  client: PoolClient,
  input: CreateTicketCommentInput
): Promise<unknown> {
  const commentId = crypto.randomUUID();

  const result = await client.query(
    `
      INSERT INTO shared.ticket_comments (
        id, ticket_id, user_id, content, is_internal, attachments
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      commentId,
      input.ticketId,
      input.userId,
      input.content,
      input.isInternal || false,
      JSON.stringify(input.attachments || []),
    ]
  );

  // Update ticket updated_at
  await client.query('UPDATE shared.support_tickets SET updated_at = NOW() WHERE id = $1', [
    input.ticketId,
  ]);

  return result.rows[0];
}

/**
 * Get ticket comments
 */
export async function getTicketComments(
  client: PoolClient,
  ticketId: string,
  includeInternal: boolean = false,

  _userId?: string
): Promise<unknown[]> {
  const conditions: string[] = ['ticket_id = $1'];
  const values: unknown[] = [ticketId];
  // paramIndex not used but kept for consistency with similar patterns
  // let paramIndex = 2;

  // Only show internal comments to support staff or ticket creator
  if (!includeInternal) {
    conditions.push(`is_internal = FALSE`);
  }

  const result = await client.query(
    `
      SELECT * FROM shared.ticket_comments
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at ASC
    `,
    values
  );

  return result.rows;
}

/**
 * Get ticket with comments
 */
export async function getTicketWithComments(
  client: PoolClient,
  ticketId: string,
  includeInternal: boolean = false,
  tenantId?: string
): Promise<unknown | null> {
  const ticket = await getTicket(client, ticketId, tenantId);
  if (!ticket) {
    return null;
  }

  const comments = await getTicketComments(client, ticketId, includeInternal);

  return {
    ...ticket,
    comments,
  };
}
