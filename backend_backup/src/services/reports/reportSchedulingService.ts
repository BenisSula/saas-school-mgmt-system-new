import type { PoolClient } from 'pg';

export interface CreateScheduledReportInput {
  tenantId: string;
  reportDefinitionId: string;
  name: string;
  scheduleType: 'daily' | 'weekly' | 'monthly' | 'custom';
  scheduleConfig: {
    cron?: string;
    dayOfWeek?: number; // 0-6 (Sunday-Saturday)
    dayOfMonth?: number; // 1-31
    time?: string; // HH:MM format
  };
  parameters?: Record<string, unknown>;
  exportFormat: 'csv' | 'pdf' | 'excel' | 'json';
  recipients: string[];
  createdBy?: string;
}

/**
 * Calculate next run time based on schedule
 */
function calculateNextRun(
  scheduleType: string,
  scheduleConfig: Record<string, unknown>
): Date {
  const now = new Date();
  const nextRun = new Date(now);

  switch (scheduleType) {
    case 'daily': {
      const time = (scheduleConfig.time as string) || '09:00';
      const [hours, minutes] = time.split(':').map(Number);
      nextRun.setHours(hours, minutes, 0, 0);
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;
    }
    case 'weekly': {
      const dayOfWeek = (scheduleConfig.dayOfWeek as number) || 1; // Monday
      const time = (scheduleConfig.time as string) || '09:00';
      const [hours, minutes] = time.split(':').map(Number);
      const currentDay = now.getDay();
      const daysUntilNext = (dayOfWeek - currentDay + 7) % 7 || 7;
      nextRun.setDate(now.getDate() + daysUntilNext);
      nextRun.setHours(hours, minutes, 0, 0);
      break;
    }
    case 'monthly': {
      const dayOfMonth = (scheduleConfig.dayOfMonth as number) || 1;
      const time = (scheduleConfig.time as string) || '09:00';
      const [hours, minutes] = time.split(':').map(Number);
      nextRun.setDate(dayOfMonth);
      nextRun.setHours(hours, minutes, 0, 0);
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
      break;
    }
    case 'custom': {
      // For custom cron, use a simple parser (in production, use a cron library)
      // This is a simplified version - assumes daily at specified time
      const cron = (scheduleConfig.cron as string) || '0 9 * * *';
      const parts = cron.split(' ');
      if (parts.length >= 2) {
        const minutes = parseInt(parts[0], 10);
        const hours = parseInt(parts[1], 10);
        nextRun.setHours(hours, minutes, 0, 0);
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
      }
      break;
    }
  }

  return nextRun;
}

/**
 * Create scheduled report
 */
export async function createScheduledReport(
  client: PoolClient,
  input: CreateScheduledReportInput
): Promise<unknown> {
  const nextRun = calculateNextRun(input.scheduleType, input.scheduleConfig);

  const result = await client.query(
    `
      INSERT INTO shared.scheduled_reports (
        tenant_id, report_definition_id, name, schedule_type,
        schedule_config, parameters, export_format, recipients,
        next_run_at, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `,
    [
      input.tenantId,
      input.reportDefinitionId,
      input.name,
      input.scheduleType,
      JSON.stringify(input.scheduleConfig),
      JSON.stringify(input.parameters || {}),
      input.exportFormat,
      input.recipients,
      nextRun,
      input.createdBy || null
    ]
  );

  return result.rows[0];
}

/**
 * Get scheduled reports ready to run
 */
export async function getScheduledReportsReadyToRun(
  client: PoolClient,
  limit: number = 10
): Promise<unknown[]> {
  const result = await client.query(
    `
      SELECT * FROM shared.scheduled_reports
      WHERE is_active = TRUE
        AND next_run_at <= NOW()
      ORDER BY next_run_at ASC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}

/**
 * Update scheduled report next run time
 */
export async function updateScheduledReportNextRun(
  client: PoolClient,
  scheduledReportId: string
): Promise<void> {
  const reportResult = await client.query(
    'SELECT * FROM shared.scheduled_reports WHERE id = $1',
    [scheduledReportId]
  );

  if ((reportResult.rowCount ?? 0) === 0) {
    throw new Error('Scheduled report not found');
  }

  const report = reportResult.rows[0];
  const nextRun = calculateNextRun(report.schedule_type, report.schedule_config);

  await client.query(
    `
      UPDATE shared.scheduled_reports
      SET next_run_at = $1,
          last_run_at = NOW(),
          updated_at = NOW()
      WHERE id = $2
    `,
    [nextRun, scheduledReportId]
  );
}

/**
 * Get scheduled reports for tenant
 */
export async function getScheduledReports(
  client: PoolClient,
  tenantId: string
): Promise<unknown[]> {
  const result = await client.query(
    `
      SELECT sr.*, rd.name as report_name, rd.description as report_description
      FROM shared.scheduled_reports sr
      JOIN shared.report_definitions rd ON rd.id = sr.report_definition_id
      WHERE sr.tenant_id = $1
      ORDER BY sr.created_at DESC
    `,
    [tenantId]
  );

  return result.rows;
}

/**
 * Update scheduled report
 */
export async function updateScheduledReport(
  client: PoolClient,
  scheduledReportId: string,
  updates: {
    name?: string;
    scheduleType?: string;
    scheduleConfig?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
    exportFormat?: string;
    recipients?: string[];
    isActive?: boolean;
  }
): Promise<unknown> {
  const updateFields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name) {
    updateFields.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }

  if (updates.scheduleType) {
    updateFields.push(`schedule_type = $${paramIndex++}`);
    values.push(updates.scheduleType);
  }

  if (updates.scheduleConfig) {
    updateFields.push(`schedule_config = $${paramIndex++}`);
    values.push(JSON.stringify(updates.scheduleConfig));
  }

  if (updates.parameters !== undefined) {
    updateFields.push(`parameters = $${paramIndex++}`);
    values.push(JSON.stringify(updates.parameters));
  }

  if (updates.exportFormat) {
    updateFields.push(`export_format = $${paramIndex++}`);
    values.push(updates.exportFormat);
  }

  if (updates.recipients) {
    updateFields.push(`recipients = $${paramIndex++}`);
    values.push(updates.recipients);
  }

  if (updates.isActive !== undefined) {
    updateFields.push(`is_active = $${paramIndex++}`);
    values.push(updates.isActive);
  }

  if (updateFields.length === 0) {
    throw new Error('No updates provided');
  }

  // Recalculate next_run_at if schedule changed
  if (updates.scheduleType || updates.scheduleConfig) {
    const reportResult = await client.query(
      'SELECT * FROM shared.scheduled_reports WHERE id = $1',
      [scheduledReportId]
    );
    if ((reportResult.rowCount ?? 0) > 0) {
      const report = reportResult.rows[0];
      const scheduleType = updates.scheduleType || report.schedule_type;
      const scheduleConfig = updates.scheduleConfig || report.schedule_config;
      const nextRun = calculateNextRun(scheduleType, scheduleConfig);
      updateFields.push(`next_run_at = $${paramIndex++}`);
      values.push(nextRun);
    }
  }

  updateFields.push(`updated_at = NOW()`);
  values.push(scheduledReportId);

  const result = await client.query(
    `
      UPDATE shared.scheduled_reports
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `,
    values
  );

  return result.rows[0];
}

/**
 * Delete scheduled report
 */
export async function deleteScheduledReport(
  client: PoolClient,
  scheduledReportId: string,
  tenantId: string
): Promise<void> {
  const result = await client.query(
    'DELETE FROM shared.scheduled_reports WHERE id = $1 AND tenant_id = $2',
    [scheduledReportId, tenantId]
  );

  if (result.rowCount === 0) {
    throw new Error('Scheduled report not found');
  }
}

