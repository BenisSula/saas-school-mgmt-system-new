import type { PoolClient } from 'pg';
import { assertValidSchemaName } from '../../db/tenantManager';

export interface ReportDefinition {
  id: string;
  tenantId?: string;
  name: string;
  description?: string;
  reportType: 'attendance' | 'grades' | 'fees' | 'users' | 'analytics' | 'custom';
  dataSource: string;
  queryTemplate: string;
  parameters: Record<string, unknown>;
  columns: Array<{ name: string; type: string; label: string }>;
  filters: Record<string, unknown>;
  rolePermissions: string[];
}

export interface ReportExecutionResult {
  executionId: string;
  data: unknown[];
  rowCount: number;
  executionTimeMs: number;
  columns: Array<{ name: string; type: string; label: string }>;
}

/**
 * Get report definition by ID
 */
export async function getReportDefinition(
  client: PoolClient,
  reportId: string,
  tenantId?: string
): Promise<ReportDefinition | null> {
  const conditions: string[] = ['id = $1'];
  const values: unknown[] = [reportId];
  let paramIndex = 2;

  if (tenantId) {
    conditions.push(`(tenant_id = $${paramIndex++} OR tenant_id IS NULL)`);
    values.push(tenantId);
  }

  const result = await client.query(
    `
      SELECT * FROM shared.report_definitions
      WHERE ${conditions.join(' AND ')} AND is_active = TRUE
    `,
    values
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description,
    reportType: row.report_type,
    dataSource: row.data_source,
    queryTemplate: row.query_template,
    parameters: row.parameters || {},
    columns: row.columns || [],
    filters: row.filters || {},
    rolePermissions: row.role_permissions || []
  };
}

/**
 * Replace template variables in SQL query
 */
function replaceQueryVariables(
  queryTemplate: string,
  parameters: Record<string, unknown>,
  tenantSchema: string
): string {
  let query = queryTemplate;

  // Replace schema placeholder
  query = query.replace(/\{\{schema\}\}/g, tenantSchema);

  // Replace parameter placeholders
  for (const [key, value] of Object.entries(parameters)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    if (typeof value === 'string') {
      query = query.replace(placeholder, `'${value.replace(/'/g, "''")}'`);
    } else if (value === null || value === undefined) {
      query = query.replace(placeholder, 'NULL');
    } else {
      query = query.replace(placeholder, String(value));
    }
  }

  return query;
}

/**
 * Execute report query
 */
export async function executeReport(
  client: PoolClient,
  tenantSchema: string,
  reportDefinition: ReportDefinition,
  parameters: Record<string, unknown> = {},
  userId?: string
): Promise<ReportExecutionResult> {
  assertValidSchemaName(tenantSchema);

  const startTime = Date.now();

  // Create execution record
  const executionResult = await client.query(
    `
      INSERT INTO shared.report_executions (
        tenant_id, report_definition_id, executed_by, parameters, status
      )
      VALUES ($1, $2, $3, $4, 'running')
      RETURNING id
    `,
    [
      reportDefinition.tenantId || null,
      reportDefinition.id,
      userId || null,
      JSON.stringify(parameters)
    ]
  );

  const executionId = executionResult.rows[0].id;

  try {
    // Replace variables in query template
    const query = replaceQueryVariables(
      reportDefinition.queryTemplate,
      parameters,
      tenantSchema
    );

    // Execute query
    const dataResult = await client.query(query);
    const executionTimeMs = Date.now() - startTime;

    // Update execution record
    await client.query(
      `
        UPDATE shared.report_executions
        SET status = 'completed',
            row_count = $1,
            execution_time_ms = $2,
            completed_at = NOW()
        WHERE id = $3
      `,
      [dataResult.rowCount, executionTimeMs, executionId]
    );

    // Create snapshot for historical comparison
    if (reportDefinition.reportType !== 'custom' && reportDefinition.tenantId) {
      await createReportSnapshot(
        client,
        reportDefinition.tenantId,
        reportDefinition.id,
        executionId,
        dataResult.rows
      );
    }

    return {
      executionId,
      data: dataResult.rows,
      rowCount: dataResult.rowCount ?? 0,
      executionTimeMs,
      columns: reportDefinition.columns.length > 0
        ? reportDefinition.columns
        : dataResult.fields.map(field => ({
            name: field.name,
            type: field.dataTypeID.toString(),
            label: field.name
          }))
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await client.query(
      `
        UPDATE shared.report_executions
        SET status = 'failed',
            execution_time_ms = $1,
            error_message = $2,
            completed_at = NOW()
        WHERE id = $3
      `,
      [executionTimeMs, errorMessage, executionId]
    );

    throw error;
  }
}

/**
 * Create report snapshot for historical comparison
 */
async function createReportSnapshot(
  client: PoolClient,
  tenantId: string,
  reportDefinitionId: string,
  executionId: string,
  data: unknown[]
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // Calculate summary metrics
  const summaryMetrics: Record<string, unknown> = {
    rowCount: data.length,
    timestamp: new Date().toISOString()
  };

  // If data has numeric columns, calculate aggregates
  if (data.length > 0) {
    const firstRow = data[0] as Record<string, unknown>;
    for (const [key, value] of Object.entries(firstRow)) {
      if (typeof value === 'number') {
        const values = data.map(row => (row as Record<string, unknown>)[key] as number);
        summaryMetrics[key] = {
          sum: values.reduce((a, b) => a + b, 0),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values)
        };
      }
    }
  }

  await client.query(
    `
      INSERT INTO shared.report_snapshots (
        tenant_id, report_definition_id, execution_id, snapshot_date, data, summary_metrics
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (tenant_id, report_definition_id, snapshot_date)
      DO UPDATE SET
        execution_id = EXCLUDED.execution_id,
        data = EXCLUDED.data,
        summary_metrics = EXCLUDED.summary_metrics
    `,
    [
      tenantId,
      reportDefinitionId,
      executionId,
      today,
      JSON.stringify(data),
      JSON.stringify(summaryMetrics)
    ]
  );
}

/**
 * Get historical trend data for comparison
 */
export async function getHistoricalTrend(
  client: PoolClient,
  tenantId: string,
  reportDefinitionId: string,
  days: number = 30
): Promise<Array<{ date: string; metrics: Record<string, unknown>; data: unknown[] }>> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const result = await client.query(
    `
      SELECT snapshot_date, summary_metrics, data
      FROM shared.report_snapshots
      WHERE tenant_id = $1
        AND report_definition_id = $2
        AND snapshot_date >= $3
      ORDER BY snapshot_date ASC
    `,
    [tenantId, reportDefinitionId, cutoffDate.toISOString().split('T')[0]]
  );

  return result.rows.map(row => ({
    date: row.snapshot_date,
    metrics: row.summary_metrics || {},
    data: row.data || []
  }));
}

/**
 * Compare current report with historical data
 */
export async function compareWithHistory(
  client: PoolClient,
  tenantId: string,
  reportDefinitionId: string,
  currentData: unknown[],
  comparisonDays: number = 7
): Promise<{
  current: Record<string, unknown>;
  previous: Record<string, unknown>;
  change: Record<string, { absolute: number; percentage: number }>;
}> {
  const trend = await getHistoricalTrend(client, tenantId, reportDefinitionId, comparisonDays);

  if (trend.length === 0) {
    return {
      current: { rowCount: currentData.length },
      previous: { rowCount: 0 },
      change: {}
    };
  }

  const previousSnapshot = trend[trend.length - 1];
  const currentMetrics: Record<string, unknown> = {
    rowCount: currentData.length,
    timestamp: new Date().toISOString()
  };

  // Calculate current metrics
  if (currentData.length > 0) {
    const firstRow = currentData[0] as Record<string, unknown>;
    for (const [key, value] of Object.entries(firstRow)) {
      if (typeof value === 'number') {
        const values = currentData.map(row => (row as Record<string, unknown>)[key] as number);
        currentMetrics[key] = {
          sum: values.reduce((a, b) => a + b, 0),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values)
        };
      }
    }
  }

  const previousMetrics = previousSnapshot.metrics as Record<string, unknown>;
  const change: Record<string, { absolute: number; percentage: number }> = {};

  // Calculate changes
  for (const [key, currentValue] of Object.entries(currentMetrics)) {
    if (key === 'timestamp') continue;

    const previousValue = previousMetrics[key];
    if (typeof currentValue === 'object' && currentValue !== null && 'sum' in currentValue) {
      const currentSum = (currentValue as { sum: number }).sum;
      const previousSum = (previousValue as { sum: number })?.sum || 0;
      const absolute = currentSum - previousSum;
      const percentage = previousSum === 0 ? 0 : (absolute / previousSum) * 100;

      change[key] = { absolute, percentage };
    } else if (typeof currentValue === 'number' && typeof previousValue === 'number') {
      const absolute = currentValue - previousValue;
      const percentage = previousValue === 0 ? 0 : (absolute / previousValue) * 100;
      change[key] = { absolute, percentage };
    }
  }

  return {
    current: currentMetrics,
    previous: previousMetrics,
    change
  };
}

