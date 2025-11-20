import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { PoolClient } from 'pg';
import { z } from 'zod';

const execAsync = promisify(exec);

export interface CreateBackupInput {
  tenantId?: string;
  backupType: 'full' | 'incremental' | 'schema_only' | 'data_only';
  storageProvider: 'local' | 's3' | 'azure' | 'gcs';
  storageLocation: string;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export interface CreateBackupScheduleInput {
  tenantId?: string;
  name: string;
  backupType: 'full' | 'incremental' | 'schema_only' | 'data_only';
  scheduleCron: string;
  retentionDays?: number;
  storageProvider: 'local' | 's3' | 'azure' | 'gcs';
  storageConfig?: Record<string, unknown>;
  createdBy?: string;
}

/**
 * Generate backup filename
 */
function generateBackupFilename(tenantId: string | null, backupType: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const prefix = tenantId ? `tenant-${tenantId}` : 'platform';
  return `${prefix}-${backupType}-${timestamp}.sql`;
}

/**
 * Execute PostgreSQL backup using pg_dump
 */
async function executePgDump(
  tenantId: string | null,
  backupType: string,
  outputPath: string,
  dbConfig: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  }
): Promise<{ success: boolean; fileSize?: number; error?: string }> {
  try {
    const env = {
      ...process.env,
      PGPASSWORD: dbConfig.password
    };

    let pgDumpArgs = '';
    if (backupType === 'schema_only') {
      pgDumpArgs = '--schema-only';
    } else if (backupType === 'data_only') {
      pgDumpArgs = '--data-only';
    }

    // If tenant-specific backup, dump only that schema
    if (tenantId) {
      pgDumpArgs += ` --schema=tenant_${tenantId}`;
    } else {
      // Platform backup includes shared schema
      pgDumpArgs += ' --schema=shared';
    }

    const command = `pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} ${pgDumpArgs} -F c -f ${outputPath}`;

    await execAsync(command, { env });

    // Get file size
    const fs = await import('fs/promises');
    const stats = await fs.stat(outputPath);
    const fileSize = stats.size;

    return { success: true, fileSize };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Create backup job
 */
export async function createBackup(
  client: PoolClient,
  input: CreateBackupInput
): Promise<unknown> {
  const backupId = crypto.randomUUID();
  const backupFilename = generateBackupFilename(input.tenantId || null, input.backupType);

  // Create backup job record
  const result = await client.query(
    `
      INSERT INTO shared.backup_jobs (
        id, tenant_id, backup_type, status, storage_location,
        storage_provider, metadata, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      backupId,
      input.tenantId || null,
      input.backupType,
      'pending',
      `${input.storageLocation}/${backupFilename}`,
      input.storageProvider,
      JSON.stringify(input.metadata || {}),
      input.createdBy || null
    ]
  );

  // In a real implementation, this would trigger an async job processor
  // For now, we'll mark it as running and simulate completion
  await client.query(
    'UPDATE shared.backup_jobs SET status = $1, started_at = NOW() WHERE id = $2',
    ['running', backupId]
  );

  return result.rows[0];
}

/**
 * Get backup jobs
 */
export async function getBackupJobs(
  client: PoolClient,
  filters: {
    tenantId?: string;
    status?: string;
    backupType?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ jobs: unknown[]; total: number }> {
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

  if (filters.backupType) {
    conditions.push(`backup_type = $${paramIndex++}`);
    values.push(filters.backupType);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await client.query(
    `SELECT COUNT(*) as total FROM shared.backup_jobs ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get jobs
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  values.push(limit, offset);

  const jobsResult = await client.query(
    `
      SELECT * FROM shared.backup_jobs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `,
    values
  );

  return {
    jobs: jobsResult.rows,
    total
  };
}

/**
 * Create backup schedule
 */
export async function createBackupSchedule(
  client: PoolClient,
  input: CreateBackupScheduleInput
): Promise<unknown> {
  const scheduleId = crypto.randomUUID();

  // Parse cron expression to calculate next run time
  // In production, use a cron parser library
  const nextRunAt = new Date();
  nextRunAt.setHours(nextRunAt.getHours() + 24); // Default: next 24 hours

  const result = await client.query(
    `
      INSERT INTO shared.backup_schedules (
        id, tenant_id, name, backup_type, schedule_cron,
        retention_days, storage_provider, storage_config,
        next_run_at, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `,
    [
      scheduleId,
      input.tenantId || null,
      input.name,
      input.backupType,
      input.scheduleCron,
      input.retentionDays || 30,
      input.storageProvider,
      JSON.stringify(input.storageConfig || {}),
      nextRunAt,
      input.createdBy || null
    ]
  );

  return result.rows[0];
}

/**
 * Get backup schedules
 */
export async function getBackupSchedules(
  client: PoolClient,
  tenantId?: string
): Promise<unknown[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (tenantId) {
    conditions.push(`(tenant_id = $${paramIndex++} OR tenant_id IS NULL)`);
    values.push(tenantId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await client.query(
    `
      SELECT * FROM shared.backup_schedules
      ${whereClause}
      ORDER BY name ASC
    `,
    values
  );

  return result.rows;
}

/**
 * Update backup schedule
 */
export async function updateBackupSchedule(
  client: PoolClient,
  scheduleId: string,
  updates: {
    name?: string;
    scheduleCron?: string;
    retentionDays?: number;
    isActive?: boolean;
    storageConfig?: Record<string, unknown>;
  }
): Promise<unknown> {
  const updateFields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name) {
    updateFields.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }

  if (updates.scheduleCron) {
    updateFields.push(`schedule_cron = $${paramIndex++}`);
    values.push(updates.scheduleCron);
    // Recalculate next run time
    const nextRunAt = new Date();
    nextRunAt.setHours(nextRunAt.getHours() + 24);
    updateFields.push(`next_run_at = $${paramIndex++}`);
    values.push(nextRunAt);
  }

  if (updates.retentionDays !== undefined) {
    updateFields.push(`retention_days = $${paramIndex++}`);
    values.push(updates.retentionDays);
  }

  if (updates.isActive !== undefined) {
    updateFields.push(`is_active = $${paramIndex++}`);
    values.push(updates.isActive);
  }

  if (updates.storageConfig !== undefined) {
    updateFields.push(`storage_config = $${paramIndex++}`);
    values.push(JSON.stringify(updates.storageConfig));
  }

  if (updateFields.length === 0) {
    throw new Error('No updates provided');
  }

  updateFields.push(`updated_at = NOW()`);
  values.push(scheduleId);

  const result = await client.query(
    `
      UPDATE shared.backup_schedules
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `,
    values
  );

  return result.rows[0];
}

/**
 * Delete backup schedule
 */
export async function deleteBackupSchedule(
  client: PoolClient,
  scheduleId: string,
  tenantId?: string
): Promise<void> {
  const conditions: string[] = ['id = $1'];
  const values: unknown[] = [scheduleId];
  let paramIndex = 2;

  if (tenantId) {
    conditions.push(`(tenant_id = $${paramIndex++} OR tenant_id IS NULL)`);
    values.push(tenantId);
  }

  const result = await client.query(
    `DELETE FROM shared.backup_schedules WHERE ${conditions.join(' AND ')}`,
    values
  );

  if (result.rowCount === 0) {
    throw new Error('Backup schedule not found');
  }
}

