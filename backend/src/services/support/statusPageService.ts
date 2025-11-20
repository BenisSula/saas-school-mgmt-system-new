import crypto from 'crypto';
import type { PoolClient } from 'pg';

export interface CreateIncidentInput {
  tenantId?: string;
  title: string;
  description: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'minor' | 'major' | 'critical';
  affectedServices?: string[];
  createdBy?: string;
}

export interface CreateIncidentUpdateInput {
  incidentId: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  message: string;
  createdBy?: string;
}

export interface CreateMaintenanceInput {
  tenantId?: string;
  title: string;
  description: string;
  affectedServices?: string[];
  scheduledStart: Date;
  scheduledEnd: Date;
  createdBy?: string;
}

/**
 * Create incident
 */
export async function createIncident(
  client: PoolClient,
  input: CreateIncidentInput
): Promise<unknown> {
  const incidentId = crypto.randomUUID();

  const result = await client.query(
    `
      INSERT INTO shared.status_incidents (
        id, tenant_id, title, description, status, severity,
        affected_services, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      incidentId,
      input.tenantId || null,
      input.title,
      input.description,
      input.status,
      input.severity,
      input.affectedServices || [],
      input.createdBy || null
    ]
  );

  // Create initial update
  await addIncidentUpdate(client, {
    incidentId,
    status: input.status,
    message: input.description,
    createdBy: input.createdBy
  });

  return result.rows[0];
}

/**
 * Get incidents
 */
export async function getIncidents(
  client: PoolClient,
  filters: {
    tenantId?: string;
    status?: string;
    severity?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ incidents: unknown[]; total: number }> {
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

  if (filters.severity) {
    conditions.push(`severity = $${paramIndex++}`);
    values.push(filters.severity);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await client.query(
    `SELECT COUNT(*) as total FROM shared.status_incidents ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get incidents
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  values.push(limit, offset);

  const incidentsResult = await client.query(
    `
      SELECT i.*,
             COUNT(u.id) as update_count
      FROM shared.status_incidents i
      LEFT JOIN shared.incident_updates u ON u.incident_id = i.id
      ${whereClause}
      GROUP BY i.id
      ORDER BY i.started_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `,
    values
  );

  return {
    incidents: incidentsResult.rows,
    total
  };
}

/**
 * Get incident with updates
 */
export async function getIncidentWithUpdates(
  client: PoolClient,
  incidentId: string
): Promise<unknown | null> {
  const incidentResult = await client.query(
    'SELECT * FROM shared.status_incidents WHERE id = $1',
    [incidentId]
  );

  if (incidentResult.rowCount === 0) {
    return null;
  }

  const incident = incidentResult.rows[0];

  // Get updates
  const updatesResult = await client.query(
    `
      SELECT u.*,
             u2.email as created_by_email
      FROM shared.incident_updates u
      LEFT JOIN shared.users u2 ON u2.id = u.created_by
      WHERE u.incident_id = $1
      ORDER BY u.created_at ASC
    `,
    [incidentId]
  );

  return {
    ...incident,
    updates: updatesResult.rows
  };
}

/**
 * Add incident update
 */
export async function addIncidentUpdate(
  client: PoolClient,
  input: CreateIncidentUpdateInput
): Promise<unknown> {
  const updateId = crypto.randomUUID();

  const result = await client.query(
    `
      INSERT INTO shared.incident_updates (
        id, incident_id, status, message, created_by
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [
      updateId,
      input.incidentId,
      input.status,
      input.message,
      input.createdBy || null
    ]
  );

  // Update incident status if changed
  await client.query(
    `
      UPDATE shared.status_incidents
      SET status = $1,
          resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END,
          updated_at = NOW()
      WHERE id = $2
    `,
    [input.status, input.incidentId]
  );

  return result.rows[0];
}

/**
 * Create scheduled maintenance
 */
export async function createScheduledMaintenance(
  client: PoolClient,
  input: CreateMaintenanceInput
): Promise<unknown> {
  const maintenanceId = crypto.randomUUID();

  const result = await client.query(
    `
      INSERT INTO shared.scheduled_maintenance (
        id, tenant_id, title, description, affected_services,
        scheduled_start, scheduled_end, status, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      maintenanceId,
      input.tenantId || null,
      input.title,
      input.description,
      input.affectedServices || [],
      input.scheduledStart,
      input.scheduledEnd,
      'scheduled',
      input.createdBy || null
    ]
  );

  return result.rows[0];
}

/**
 * Get scheduled maintenance
 */
export async function getScheduledMaintenance(
  client: PoolClient,
  filters: {
    tenantId?: string;
    status?: string;
    upcomingOnly?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<{ maintenance: unknown[]; total: number }> {
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

  if (filters.upcomingOnly) {
    conditions.push(`scheduled_start >= NOW()`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await client.query(
    `SELECT COUNT(*) as total FROM shared.scheduled_maintenance ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get maintenance
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  values.push(limit, offset);

  const maintenanceResult = await client.query(
    `
      SELECT * FROM shared.scheduled_maintenance
      ${whereClause}
      ORDER BY scheduled_start ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `,
    values
  );

  return {
    maintenance: maintenanceResult.rows,
    total
  };
}

/**
 * Update maintenance status
 */
export async function updateMaintenanceStatus(
  client: PoolClient,
  maintenanceId: string,
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled',
  actualStart?: Date,
  actualEnd?: Date
): Promise<unknown> {
  const updates: string[] = ['status = $1', 'updated_at = NOW()'];
  const values: unknown[] = [status];
  let paramIndex = 2;

  if (actualStart) {
    updates.push(`actual_start = $${paramIndex++}`);
    values.push(actualStart);
  }

  if (actualEnd) {
    updates.push(`actual_end = $${paramIndex++}`);
    values.push(actualEnd);
  }

  values.push(maintenanceId);

  const result = await client.query(
    `
      UPDATE shared.scheduled_maintenance
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `,
    values
  );

  return result.rows[0];
}

/**
 * Record uptime check
 */
export async function recordUptimeCheck(
  client: PoolClient,
  input: {
    tenantId?: string;
    serviceName: string;
    status: 'up' | 'down' | 'degraded';
    responseTimeMs?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await client.query(
    `
      INSERT INTO shared.uptime_records (
        tenant_id, service_name, status, response_time_ms, metadata
      )
      VALUES ($1, $2, $3, $4, $5)
    `,
    [
      input.tenantId || null,
      input.serviceName,
      input.status,
      input.responseTimeMs || null,
      JSON.stringify(input.metadata || {})
    ]
  );
}

/**
 * Get uptime statistics
 */
export async function getUptimeStatistics(
  client: PoolClient,
  filters: {
    tenantId?: string;
    serviceName?: string;
    days?: number;
  }
): Promise<{
  serviceName: string;
  uptimePercentage: number;
  totalChecks: number;
  upChecks: number;
  downChecks: number;
  degradedChecks: number;
  averageResponseTime: number;
  lastStatus: string;
  lastChecked: Date;
}> {
  const days = filters.days || 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const conditions: string[] = ['checked_at >= $1'];
  const values: unknown[] = [cutoffDate];
  let paramIndex = 2;

  if (filters.tenantId) {
    conditions.push(`(tenant_id = $${paramIndex++} OR tenant_id IS NULL)`);
    values.push(filters.tenantId);
  }

  if (filters.serviceName) {
    conditions.push(`service_name = $${paramIndex++}`);
    values.push(filters.serviceName);
  }

  const result = await client.query(
    `
      SELECT
        service_name,
        COUNT(*)::int as total_checks,
        COUNT(*) FILTER (WHERE status = 'up')::int as up_checks,
        COUNT(*) FILTER (WHERE status = 'down')::int as down_checks,
        COUNT(*) FILTER (WHERE status = 'degraded')::int as degraded_checks,
        ROUND(
          (COUNT(*) FILTER (WHERE status = 'up')::float / NULLIF(COUNT(*), 0)) * 100,
          2
        ) as uptime_percentage,
        ROUND(AVG(response_time_ms), 2) as average_response_time,
        (SELECT status FROM shared.uptime_records
         WHERE service_name = u.service_name
         ORDER BY checked_at DESC LIMIT 1) as last_status,
        MAX(checked_at) as last_checked
      FROM shared.uptime_records u
      WHERE ${conditions.join(' AND ')}
      GROUP BY service_name
      ORDER BY service_name
    `,
    values
  );

  return result.rows.map(row => ({
    serviceName: row.service_name,
    uptimePercentage: parseFloat(row.uptime_percentage) || 0,
    totalChecks: row.total_checks,
    upChecks: row.up_checks,
    downChecks: row.down_checks,
    degradedChecks: row.degraded_checks,
    averageResponseTime: parseFloat(row.average_response_time) || 0,
    lastStatus: row.last_status,
    lastChecked: row.last_checked
  })) as unknown as {
    serviceName: string;
    uptimePercentage: number;
    totalChecks: number;
    upChecks: number;
    downChecks: number;
    degradedChecks: number;
    averageResponseTime: number;
    lastStatus: string;
    lastChecked: Date;
  };
}

/**
 * Get status page summary (public view)
 */
export async function getStatusPageSummary(
  client: PoolClient,
  tenantId?: string
): Promise<{
  overallStatus: 'operational' | 'degraded' | 'down';
  services: Array<{
    name: string;
    status: 'up' | 'down' | 'degraded';
    uptimePercentage: number;
  }>;
  activeIncidents: unknown[];
  upcomingMaintenance: unknown[];
}> {
  // Get active incidents
  const incidentsResult = await client.query(
    `
      SELECT * FROM shared.status_incidents
      WHERE (tenant_id = $1 OR tenant_id IS NULL)
        AND status != 'resolved'
      ORDER BY severity DESC, started_at DESC
      LIMIT 5
    `,
    [tenantId || null]
  );

  // Get upcoming maintenance
  const maintenanceResult = await client.query(
    `
      SELECT * FROM shared.scheduled_maintenance
      WHERE (tenant_id = $1 OR tenant_id IS NULL)
        AND status IN ('scheduled', 'in_progress')
        AND scheduled_start >= NOW()
      ORDER BY scheduled_start ASC
      LIMIT 5
    `,
    [tenantId || null]
  );

  // Get uptime statistics
  const uptimeStats = await getUptimeStatistics(client, { tenantId, days: 30 });

  // Determine overall status
  let overallStatus: 'operational' | 'degraded' | 'down' = 'operational';
  const hasCriticalIncident = incidentsResult.rows.some(
    (inc: { severity: string }) => inc.severity === 'critical'
  );
  const hasDownService = uptimeStats.some(
    (stat: { lastStatus: string }) => stat.lastStatus === 'down'
  );
  const hasDegradedService = uptimeStats.some(
    (stat: { lastStatus: string }) => stat.lastStatus === 'degraded'
  );

  if (hasCriticalIncident || hasDownService) {
    overallStatus = 'down';
  } else if (hasDegradedService) {
    overallStatus = 'degraded';
  }

  return {
    overallStatus,
    services: uptimeStats.map(stat => ({
      name: stat.serviceName,
      status: stat.lastStatus as 'up' | 'down' | 'degraded',
      uptimePercentage: stat.uptimePercentage
    })),
    activeIncidents: incidentsResult.rows,
    upcomingMaintenance: maintenanceResult.rows
  };
}

