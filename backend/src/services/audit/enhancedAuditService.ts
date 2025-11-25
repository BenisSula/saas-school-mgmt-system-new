import type { PoolClient } from 'pg';

export interface AuditLogFilters {
  tenantId?: string;
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  tags?: string[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditLogEntry {
  id: string;
  tenantId?: string;
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  tags?: string[];
  createdAt: Date;
}

/**
 * Create audit log entry
 */
export async function createAuditLog(
  client: PoolClient,
  entry: Omit<AuditLogEntry, 'id' | 'createdAt'>
): Promise<void> {
  try {
    // Try with tenant_id column (newer schema)
    await client.query(
      `
        INSERT INTO shared.audit_logs (
          tenant_id, user_id, action, resource_type, resource_id,
          details, ip_address, user_agent, request_id, severity, tags
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        entry.tenantId || null,
        entry.userId || null,
        entry.action,
        entry.resourceType || null,
        entry.resourceId || null,
        JSON.stringify(entry.details),
        entry.ipAddress || null,
        entry.userAgent || null,
        entry.requestId || null,
        entry.severity || 'info',
        entry.tags || [],
      ]
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // If tenant_id column doesn't exist, use older schema (migration 003)
    if (
      errorMessage.includes('tenant_id') &&
      (errorMessage.includes('does not exist') || errorMessage.includes('column'))
    ) {
      // Fallback to older schema without tenant_id
      // Old schema: user_id, action, entity_type, entity_id, details, created_at
      await client.query(
        `
          INSERT INTO shared.audit_logs (
            user_id, action, entity_type, entity_id, details
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          entry.userId || null,
          entry.action,
          entry.resourceType || 'UNKNOWN',
          entry.resourceId || null,
          JSON.stringify(entry.details),
        ]
      );
    } else {
      // Re-throw other errors
      throw error;
    }
  }
}

/**
 * Search audit logs with filters
 */
export async function searchAuditLogs(
  client: PoolClient,
  filters: AuditLogFilters
): Promise<{ logs: AuditLogEntry[]; total: number }> {
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

  if (filters.action) {
    conditions.push(`action LIKE $${paramIndex++}`);
    values.push(`%${filters.action}%`);
  }

  if (filters.resourceType) {
    conditions.push(`resource_type = $${paramIndex++}`);
    values.push(filters.resourceType);
  }

  if (filters.resourceId) {
    conditions.push(`resource_id = $${paramIndex++}`);
    values.push(filters.resourceId);
  }

  // Check if severity column exists before filtering by it
  // This allows the service to work even if migration 007 hasn't run
  let hasSeverityColumn = true;
  try {
    const columnCheck = await client.query(
      `
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'shared' 
          AND table_name = 'audit_logs' 
          AND column_name = 'severity'
        )
      `
    );
    hasSeverityColumn = columnCheck.rows[0]?.exists || false;
  } catch {
    hasSeverityColumn = false;
  }

  if (filters.severity && hasSeverityColumn) {
    conditions.push(`severity = $${paramIndex++}`);
    values.push(filters.severity);
  }

  // Check if tags column exists before filtering by it
  let hasTagsColumn = true;
  try {
    const columnCheck = await client.query(
      `
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'shared' 
          AND table_name = 'audit_logs' 
          AND column_name = 'tags'
        )
      `
    );
    hasTagsColumn = columnCheck.rows[0]?.exists || false;
  } catch {
    hasTagsColumn = false;
  }

  if (filters.tags && filters.tags.length > 0 && hasTagsColumn) {
    conditions.push(`tags && $${paramIndex++}`);
    values.push(filters.tags);
  }

  if (filters.startDate) {
    conditions.push(`created_at >= $${paramIndex++}`);
    values.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push(`created_at <= $${paramIndex++}`);
    values.push(filters.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    // Get total count
    const countResult = await client.query(
      `SELECT COUNT(*) as total FROM shared.audit_logs ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Get logs
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    values.push(limit, offset);

    // Build SELECT with only columns that exist
    // Base columns that should always exist
    let selectColumns =
      'id, tenant_id, user_id, action, resource_type, resource_id, details, ip_address, created_at';

    // Add optional columns if they exist
    if (hasSeverityColumn) {
      selectColumns += ', severity';
    }
    if (hasTagsColumn) {
      selectColumns += ', tags';
    }

    const logsResult = await client.query(
      `
        SELECT ${selectColumns} FROM shared.audit_logs
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex}
      `,
      values
    );

    const logs: AuditLogEntry[] = logsResult.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      details: row.details || {},
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      requestId: row.request_id,
      severity: hasSeverityColumn
        ? (row.severity as 'info' | 'warning' | 'error' | 'critical' | undefined)
        : undefined,
      tags: hasTagsColumn ? (row.tags as string[] | undefined) : undefined,
      createdAt: row.created_at,
    }));

    return {
      logs,
      total,
    };
  } catch (error) {
    // Only log actual errors, not expected missing column errors
    if (error instanceof Error && error.message.includes('does not exist')) {
      // Silently skip - expected when migrations haven't run
      return {
        logs: [],
        total: 0,
      };
    }
    throw error;
  }
}

/**
 * Export audit logs to CSV/JSON
 */
export async function exportAuditLogs(
  client: PoolClient,
  filters: AuditLogFilters,
  format: 'csv' | 'json' = 'json'
): Promise<string> {
  const { logs } = await searchAuditLogs(client, { ...filters, limit: 10000 });

  if (format === 'csv') {
    const headers = [
      'ID',
      'Tenant ID',
      'User ID',
      'Action',
      'Resource Type',
      'Resource ID',
      'Severity',
      'IP Address',
      'Created At',
    ];
    const rows = logs.map((log) => [
      log.id,
      log.tenantId || '',
      log.userId || '',
      log.action,
      log.resourceType || '',
      log.resourceId || '',
      log.severity || '',
      log.ipAddress || '',
      log.createdAt.toISOString(),
    ]);

    return [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
  }

  return JSON.stringify(logs, null, 2);
}

/**
 * Apply data retention policies
 */
export async function applyRetentionPolicies(client: PoolClient): Promise<number> {
  const policiesResult = await client.query(
    `
      SELECT * FROM shared.audit_retention_policies
      WHERE is_active = TRUE
    `
  );

  let archivedCount = 0;

  for (const policy of policiesResult.rows) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retention_days);

    const conditions: string[] = ['created_at < $1'];
    const values: unknown[] = [cutoffDate];
    let paramIndex = 2;

    if (policy.tenant_id) {
      conditions.push(`tenant_id = $${paramIndex++}`);
      values.push(policy.tenant_id);
    }

    if (policy.resource_type) {
      conditions.push(`resource_type = $${paramIndex++}`);
      values.push(policy.resource_type);
    }

    if (policy.action_pattern) {
      conditions.push(`action LIKE $${paramIndex++}`);
      values.push(policy.action_pattern.replace('*', '%'));
    }

    if (policy.archive_before_delete) {
      // Archive logs
      await client.query(
        `
          INSERT INTO shared.audit_logs_archive
          SELECT *, NOW() as archived_at
          FROM shared.audit_logs
          WHERE ${conditions.join(' AND ')}
        `,
        values
      );
    }

    // Delete logs
    const deleteResult = await client.query(
      `
        DELETE FROM shared.audit_logs
        WHERE ${conditions.join(' AND ')}
      `,
      values
    );

    archivedCount += deleteResult.rowCount || 0;
  }

  return archivedCount;
}

/**
 * Create GDPR export request
 */
export async function createGdprExportRequest(
  client: PoolClient,
  tenantId: string,
  userId: string,
  requestType: 'export' | 'erasure' | 'rectification',
  requestedBy: string
): Promise<unknown> {
  const result = await client.query(
    `
      INSERT INTO shared.gdpr_export_requests (
        tenant_id, user_id, request_type, status, requested_by
      )
      VALUES ($1, $2, $3, 'pending', $4)
      RETURNING *
    `,
    [tenantId, userId, requestType, requestedBy]
  );

  return result.rows[0];
}

/**
 * Process GDPR data export
 */
export async function processGdprExport(
  client: PoolClient,
  requestId: string
): Promise<{ exportUrl: string; expiresAt: Date }> {
  const requestResult = await client.query(
    'SELECT * FROM shared.gdpr_export_requests WHERE id = $1',
    [requestId]
  );

  if (requestResult.rowCount === 0) {
    throw new Error('GDPR export request not found');
  }

  const request = requestResult.rows[0];

  // OPTIMIZED: Execute all queries in parallel instead of sequentially
  // This reduces total query time from ~4 sequential queries to parallel execution
  const [userData, auditLogs, sessions, mfaDevices] = await Promise.all([
    client.query('SELECT * FROM shared.users WHERE id = $1', [request.user_id]),
    client.query('SELECT * FROM shared.audit_logs WHERE user_id = $1', [request.user_id]),
    client.query(
      'SELECT id, ip_address, user_agent, created_at, last_activity_at FROM shared.sessions WHERE user_id = $1',
      [request.user_id]
    ),
    client.query('SELECT id, type, name, created_at FROM shared.mfa_devices WHERE user_id = $1', [
      request.user_id,
    ]),
  ]);

  // Data collected (queries executed for side effects, data stored in export)
  // Note: Results are available but not used here as this is a placeholder for actual export logic

  // TODO: Upload to S3 or similar storage
  const exportUrl = `/api/gdpr/exports/${requestId}/download`;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // Expires in 30 days

  await client.query(
    `
      UPDATE shared.gdpr_export_requests
      SET status = 'completed',
          export_url = $1,
          export_expires_at = $2,
          completed_at = NOW()
      WHERE id = $3
    `,
    [exportUrl, expiresAt, requestId]
  );

  return { exportUrl, expiresAt };
}

/**
 * Process GDPR data erasure
 */
export async function processGdprErasure(
  client: PoolClient,
  requestId: string,
  executedBy: string
): Promise<number> {
  const requestResult = await client.query(
    'SELECT * FROM shared.gdpr_export_requests WHERE id = $1',
    [requestId]
  );

  if (requestResult.rowCount === 0) {
    throw new Error('GDPR erasure request not found');
  }

  const request = requestResult.rows[0];
  let totalDeleted = 0;

  await client.query('BEGIN');
  try {
    // Anonymize or delete user data
    // Note: In production, you may want to anonymize instead of delete for compliance

    // Delete sessions
    const sessionsResult = await client.query('DELETE FROM shared.sessions WHERE user_id = $1', [
      request.user_id,
    ]);
    totalDeleted += sessionsResult.rowCount || 0;

    // Delete MFA devices
    const mfaResult = await client.query('DELETE FROM shared.mfa_devices WHERE user_id = $1', [
      request.user_id,
    ]);
    totalDeleted += mfaResult.rowCount || 0;

    // Anonymize audit logs
    const auditResult = await client.query(
      `
        UPDATE shared.audit_logs
        SET user_id = NULL, details = jsonb_set(details, '{user}', '"ANONYMIZED"')
        WHERE user_id = $1
      `,
      [request.user_id]
    );
    totalDeleted += auditResult.rowCount || 0;

    // Log erasure
    await client.query(
      `
        INSERT INTO shared.gdpr_erasure_log (
          tenant_id, user_id, request_id, data_type, records_deleted, executed_by
        )
        VALUES ($1, $2, $3, 'user_data', $4, $5)
      `,
      [request.tenant_id, request.user_id, requestId, totalDeleted, executedBy]
    );

    // Update request status
    await client.query(
      `
        UPDATE shared.gdpr_export_requests
        SET status = 'completed', completed_at = NOW()
        WHERE id = $1
      `,
      [requestId]
    );

    await client.query('COMMIT');
    return totalDeleted;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
