import crypto from 'crypto';
import type { PoolClient } from 'pg';

export interface CreateGdprErasureRequestInput {
  tenantId: string;
  userId: string;
  requestType: 'full_erasure' | 'anonymize' | 'export_only';
  reason?: string;
  dataCategories?: string[];
  requestedBy?: string;
}

/**
 * Generate verification token for GDPR request
 */
function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create GDPR erasure request
 */
export async function createGdprErasureRequest(
  client: PoolClient,
  input: CreateGdprErasureRequestInput
): Promise<unknown> {
  const requestId = crypto.randomUUID();
  const verificationToken = generateVerificationToken();

  const result = await client.query(
    `
      INSERT INTO shared.gdpr_erasure_requests (
        id, tenant_id, user_id, request_type, status,
        reason, data_categories, verification_token, requested_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      requestId,
      input.tenantId,
      input.userId,
      input.requestType,
      'pending',
      input.reason || null,
      input.dataCategories || [],
      verificationToken,
      input.requestedBy || null
    ]
  );

  return result.rows[0];
}

/**
 * Verify GDPR erasure request
 */
export async function verifyGdprErasureRequest(
  client: PoolClient,
  requestId: string,
  verificationToken: string
): Promise<boolean> {
  const result = await client.query(
    `
      UPDATE shared.gdpr_erasure_requests
      SET verified_at = NOW(),
          status = 'processing'
      WHERE id = $1 AND verification_token = $2 AND status = 'pending'
      RETURNING *
    `,
    [requestId, verificationToken]
  );

  return result.rowCount > 0;
}

/**
 * Process GDPR erasure request
 */
export async function processGdprErasure(
  client: PoolClient,
  requestId: string,
  processedBy: string
): Promise<unknown> {
  // Get request details
  const requestResult = await client.query(
    'SELECT * FROM shared.gdpr_erasure_requests WHERE id = $1',
    [requestId]
  );

  if (requestResult.rowCount === 0) {
    throw new Error('GDPR erasure request not found');
  }

  const request = requestResult.rows[0];

  if (request.status !== 'processing') {
    throw new Error('Request is not in processing status');
  }

  const erasureReport: {
    tablesAffected: string[];
    recordsDeleted: number;
    recordsAnonymized: number;
    dataCategories: string[];
  } = {
    tablesAffected: [],
    recordsDeleted: 0,
    recordsAnonymized: 0,
    dataCategories: request.data_categories || []
  };

  // Process based on request type
  if (request.request_type === 'full_erasure') {
    // Delete user data from all tenant tables
    // In production, iterate through all tenant schema tables
    const tablesToProcess = [
      'users',
      'students',
      'teachers',
      'attendance',
      'grades',
      'invoices',
      'messages'
    ];

    for (const table of tablesToProcess) {
      try {
        const deleteResult = await client.query(
          `DELETE FROM tenant_${request.tenant_id}.${table} WHERE user_id = $1 OR id = $1`,
          [request.user_id]
        );
        erasureReport.recordsDeleted += deleteResult.rowCount || 0;
        if (deleteResult.rowCount > 0) {
          erasureReport.tablesAffected.push(table);
        }
      } catch (error) {
        // Table might not exist or have different structure
        console.warn(`Failed to delete from ${table}:`, error);
      }
    }

    // Delete from shared schema
    await client.query(
      'DELETE FROM shared.users WHERE id = $1',
      [request.user_id]
    );
    erasureReport.recordsDeleted += 1;
    erasureReport.tablesAffected.push('shared.users');
  } else if (request.request_type === 'anonymize') {
    // Anonymize user data instead of deleting
    const anonymizedEmail = `deleted-${crypto.randomUUID()}@anonymized.local`;
    const anonymizedName = 'Deleted User';

    // Anonymize in shared.users
    await client.query(
      `
        UPDATE shared.users
        SET email = $1,
            first_name = $2,
            last_name = $2,
            phone = NULL,
            metadata = jsonb_build_object('anonymized', true, 'anonymized_at', NOW())
        WHERE id = $3
      `,
      [anonymizedEmail, anonymizedName, request.user_id]
    );
    erasureReport.recordsAnonymized += 1;
    erasureReport.tablesAffected.push('shared.users');

    // Anonymize in tenant tables
    const tablesToAnonymize = ['students', 'teachers'];
    for (const table of tablesToAnonymize) {
      try {
        const updateResult = await client.query(
          `
            UPDATE tenant_${request.tenant_id}.${table}
            SET first_name = $1,
                last_name = $1,
                email = $2,
                phone = NULL
            WHERE user_id = $3
          `,
          [anonymizedName, anonymizedEmail, request.user_id]
        );
        erasureReport.recordsAnonymized += updateResult.rowCount || 0;
        if (updateResult.rowCount > 0) {
          erasureReport.tablesAffected.push(table);
        }
      } catch (error) {
        console.warn(`Failed to anonymize ${table}:`, error);
      }
    }
  } else if (request.request_type === 'export_only') {
    // Just export data, no deletion
    erasureReport.tablesAffected = ['export_only'];
  }

  // Update request status
  await client.query(
    `
      UPDATE shared.gdpr_erasure_requests
      SET status = 'completed',
          processed_at = NOW(),
          processed_by = $1,
          erasure_report = $2
      WHERE id = $3
    `,
    [processedBy, JSON.stringify(erasureReport), requestId]
  );

  return {
    ...request,
    erasure_report: erasureReport,
    status: 'completed',
    processed_at: new Date(),
    processed_by: processedBy
  };
}

/**
 * Get GDPR erasure requests
 */
export async function getGdprErasureRequests(
  client: PoolClient,
  filters: {
    tenantId?: string;
    userId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ requests: unknown[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.tenantId) {
    conditions.push(`tenant_id = $${paramIndex++}`);
    values.push(filters.tenantId);
  }

  if (filters.userId) {
    conditions.push(`user_id = $${paramIndex++}`);
    values.push(filters.userId);
  }

  if (filters.status) {
    conditions.push(`status = $${paramIndex++}`);
    values.push(filters.status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await client.query(
    `SELECT COUNT(*) as total FROM shared.gdpr_erasure_requests ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get requests
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  values.push(limit, offset);

  const requestsResult = await client.query(
    `
      SELECT r.*,
             u.email as user_email,
             u.first_name as user_first_name,
             u.last_name as user_last_name
      FROM shared.gdpr_erasure_requests r
      LEFT JOIN shared.users u ON u.id = r.user_id
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `,
    values
  );

  return {
    requests: requestsResult.rows,
    total
  };
}

/**
 * Cancel GDPR erasure request
 */
export async function cancelGdprErasureRequest(
  client: PoolClient,
  requestId: string
): Promise<void> {
  const result = await client.query(
    `
      UPDATE shared.gdpr_erasure_requests
      SET status = 'cancelled',
          updated_at = NOW()
      WHERE id = $1 AND status IN ('pending', 'processing')
    `,
    [requestId]
  );

  if (result.rowCount === 0) {
    throw new Error('Request not found or cannot be cancelled');
  }
}

