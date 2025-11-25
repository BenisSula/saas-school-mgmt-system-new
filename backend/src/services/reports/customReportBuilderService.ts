import type { PoolClient } from 'pg';
import { assertValidSchemaName } from '../../db/tenantManager';

export interface CustomReportInput {
  tenantId: string;
  name: string;
  description?: string;
  baseTemplateId?: string;
  dataSources: string[];
  joins?: Array<{
    type: 'inner' | 'left' | 'right' | 'full';
    table: string;
    on: string; // Join condition
  }>;
  selectedColumns: Array<{
    table: string;
    column: string;
    alias?: string;
    aggregate?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  }>;
  filters?: Array<{
    column: string;
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'BETWEEN';
    value: unknown;
  }>;
  groupBy?: string[];
  orderBy?: Array<{
    column: string;
    direction: 'ASC' | 'DESC';
  }>;
  visualizationType?: 'table' | 'bar' | 'line' | 'pie' | 'area';
  rolePermissions?: string[];
  isShared?: boolean;
  createdBy?: string;
}

/**
 * Build SQL query from custom report configuration
 */
function buildCustomReportQuery(tenantSchema: string, config: CustomReportInput): string {
  assertValidSchemaName(tenantSchema);

  let query = 'SELECT ';

  // Check if any columns have aggregations
  const hasAggregations = config.selectedColumns.some((col) => col.aggregate);

  // Build SELECT clause
  const selectParts: string[] = [];
  const nonAggregatedColumns: string[] = [];

  for (const col of config.selectedColumns) {
    let selectExpr = `${tenantSchema}.${col.table}.${col.column}`;
    const columnAlias = col.alias || `${col.table}_${col.column}`;

    if (col.aggregate) {
      selectExpr = `${col.aggregate.toUpperCase()}(${selectExpr})`;
    } else {
      // Track non-aggregated columns for GROUP BY
      nonAggregatedColumns.push(`${tenantSchema}.${col.table}.${col.column}`);
    }

    selectExpr += ` AS ${columnAlias}`;
    selectParts.push(selectExpr);
  }
  query += selectParts.join(', ');

  // Build FROM clause
  if (config.dataSources.length === 0) {
    throw new Error('At least one data source is required');
  }
  query += ` FROM ${tenantSchema}.${config.dataSources[0]}`;

  // Build JOINs
  if (config.joins) {
    for (const join of config.joins) {
      query += ` ${join.type.toUpperCase()} JOIN ${tenantSchema}.${join.table} ON ${join.on}`;
    }
  }

  // Build WHERE clause
  if (config.filters && config.filters.length > 0) {
    const whereParts: string[] = [];
    for (const filter of config.filters) {
      // Fully qualify column references in WHERE clause
      let columnRef = filter.column;
      // If column doesn't have schema.table prefix, try to find it from selectedColumns
      if (!columnRef.includes('.')) {
        const matchingCol = config.selectedColumns.find((c) => c.column === filter.column);
        if (matchingCol) {
          columnRef = `${tenantSchema}.${matchingCol.table}.${filter.column}`;
        } else {
          // Default to first data source if not found
          columnRef = `${tenantSchema}.${config.dataSources[0]}.${filter.column}`;
        }
      }

      let condition = `${columnRef} ${filter.operator}`;
      if (filter.operator === 'IN') {
        const values = Array.isArray(filter.value)
          ? filter.value.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(', ')
          : `'${String(filter.value).replace(/'/g, "''")}'`;
        condition += ` (${values})`;
      } else if (filter.operator === 'BETWEEN') {
        const values = Array.isArray(filter.value) ? filter.value : [filter.value, filter.value];
        condition += ` '${String(values[0]).replace(/'/g, "''")}' AND '${String(values[1]).replace(/'/g, "''")}'`;
      } else if (filter.operator === 'LIKE') {
        condition += ` '${String(filter.value).replace(/'/g, "''")}'`;
      } else {
        // For numeric comparisons, don't quote
        const numValue = Number(filter.value);
        if (!isNaN(numValue) && filter.operator !== '=' && filter.operator !== '!=') {
          condition += ` ${numValue}`;
        } else {
          condition += ` '${String(filter.value).replace(/'/g, "''")}'`;
        }
      }
      whereParts.push(condition);
    }
    query += ` WHERE ${whereParts.join(' AND ')}`;
  }

  // Build GROUP BY clause
  // If aggregations are used, GROUP BY non-aggregated columns
  if (hasAggregations) {
    if (config.groupBy && config.groupBy.length > 0) {
      // Use provided groupBy columns, fully qualify them
      const groupByParts = config.groupBy.map((col) => {
        if (col.includes('.')) {
          return col;
        }
        const matchingCol = config.selectedColumns.find((c) => c.column === col);
        if (matchingCol) {
          return `${tenantSchema}.${matchingCol.table}.${col}`;
        }
        return `${tenantSchema}.${config.dataSources[0]}.${col}`;
      });
      query += ` GROUP BY ${groupByParts.join(', ')}`;
    } else if (nonAggregatedColumns.length > 0) {
      // Auto-GROUP BY non-aggregated columns
      query += ` GROUP BY ${nonAggregatedColumns.join(', ')}`;
    }
  } else if (config.groupBy && config.groupBy.length > 0) {
    // No aggregations but groupBy specified
    const groupByParts = config.groupBy.map((col) => {
      if (col.includes('.')) {
        return col;
      }
      const matchingCol = config.selectedColumns.find((c) => c.column === col);
      if (matchingCol) {
        return `${tenantSchema}.${matchingCol.table}.${col}`;
      }
      return `${tenantSchema}.${config.dataSources[0]}.${col}`;
    });
    query += ` GROUP BY ${groupByParts.join(', ')}`;
  }

  // Build ORDER BY clause
  if (config.orderBy && config.orderBy.length > 0) {
    const orderParts = config.orderBy.map((order) => {
      let orderCol = order.column;
      // Fully qualify column references
      if (!orderCol.includes('.')) {
        const matchingCol = config.selectedColumns.find((c) => c.column === order.column);
        if (matchingCol) {
          orderCol = `${tenantSchema}.${matchingCol.table}.${order.column}`;
        } else {
          orderCol = `${tenantSchema}.${config.dataSources[0]}.${order.column}`;
        }
      }
      return `${orderCol} ${order.direction}`;
    });
    query += ` ORDER BY ${orderParts.join(', ')}`;
  }

  return query;
}

/**
 * Create custom report
 */
export async function createCustomReport(
  client: PoolClient,
  tenantSchema: string,
  input: CustomReportInput
): Promise<unknown> {
  // Build query to validate it
  buildCustomReportQuery(tenantSchema, input);

  // Test query (just validate syntax, don't execute)
  // In production, you might want to execute with LIMIT 1 to validate

  // Create custom report record
  const result = await client.query(
    `
      INSERT INTO shared.custom_reports (
        tenant_id, name, description, base_template_id,
        data_sources, joins, selected_columns, filters,
        group_by, order_by, aggregations, visualization_type,
        role_permissions, is_shared, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `,
    [
      input.tenantId,
      input.name,
      input.description || null,
      input.baseTemplateId || null,
      input.dataSources,
      JSON.stringify(input.joins || []),
      JSON.stringify(input.selectedColumns),
      JSON.stringify(input.filters || []),
      input.groupBy || [],
      JSON.stringify(input.orderBy || []),
      JSON.stringify(
        input.selectedColumns
          .filter((col) => col.aggregate)
          .map((col) => ({ column: col.column, aggregate: col.aggregate }))
      ),
      input.visualizationType || 'table',
      input.rolePermissions || [],
      input.isShared || false,
      input.createdBy || null,
    ]
  );

  return result.rows[0];
}

/**
 * Execute custom report
 */
export async function executeCustomReport(
  client: PoolClient,
  tenantSchema: string,
  customReportId: string
): Promise<{
  data: unknown[];
  columns: Array<{ name: string; label: string }>;
  rowCount: number;
}> {
  // Get custom report
  const reportResult = await client.query('SELECT * FROM shared.custom_reports WHERE id = $1', [
    customReportId,
  ]);

  if (reportResult.rowCount === 0) {
    throw new Error('Custom report not found');
  }

  const report = reportResult.rows[0];

  // Build query
  const config: CustomReportInput = {
    tenantId: report.tenant_id,
    name: report.name,
    dataSources: report.data_sources,
    joins: report.joins || [],
    selectedColumns: report.selected_columns,
    filters: report.filters || [],
    groupBy: report.group_by,
    orderBy: report.order_by || [],
  };

  const query = buildCustomReportQuery(tenantSchema, config);

  // Execute query
  const startTime = Date.now();
  const result = await client.query(query);
  // Execution time calculated but not used yet - kept for future performance tracking
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _executionTimeMs = Date.now() - startTime;

  // Build columns metadata from selectedColumns
  const columns = config.selectedColumns.map((col) => ({
    name: col.alias || `${col.table}_${col.column}`,
    label:
      col.alias ||
      `${col.table}_${col.column}`.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
  }));

  return {
    data: result.rows,
    columns,
    rowCount: result.rowCount || 0,
  };
}

/**
 * Get custom reports for tenant
 */
export async function getCustomReports(
  client: PoolClient,
  tenantId: string,
  userId?: string
): Promise<unknown[]> {
  const conditions: string[] = ['tenant_id = $1'];
  const values: unknown[] = [tenantId];
  let paramIndex = 2;

  // Show shared reports or user's own reports
  if (userId) {
    conditions.push(`(is_shared = TRUE OR created_by = $${paramIndex++})`);
    values.push(userId);
  } else {
    conditions.push('is_shared = TRUE');
  }

  const result = await client.query(
    `
      SELECT * FROM shared.custom_reports
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
    `,
    values
  );

  return result.rows;
}

/**
 * Update custom report
 */
export async function updateCustomReport(
  client: PoolClient,
  tenantSchema: string,
  customReportId: string,
  updates: Partial<CustomReportInput>
): Promise<unknown> {
  const updateFields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name) {
    updateFields.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }

  if (updates.description !== undefined) {
    updateFields.push(`description = $${paramIndex++}`);
    values.push(updates.description);
  }

  if (updates.selectedColumns) {
    updateFields.push(`selected_columns = $${paramIndex++}`);
    values.push(JSON.stringify(updates.selectedColumns));
  }

  if (updates.filters !== undefined) {
    updateFields.push(`filters = $${paramIndex++}`);
    values.push(JSON.stringify(updates.filters));
  }

  if (updates.groupBy !== undefined) {
    updateFields.push(`group_by = $${paramIndex++}`);
    values.push(updates.groupBy);
  }

  if (updates.orderBy !== undefined) {
    updateFields.push(`order_by = $${paramIndex++}`);
    values.push(JSON.stringify(updates.orderBy));
  }

  if (updates.visualizationType) {
    updateFields.push(`visualization_type = $${paramIndex++}`);
    values.push(updates.visualizationType);
  }

  if (updates.isShared !== undefined) {
    updateFields.push(`is_shared = $${paramIndex++}`);
    values.push(updates.isShared);
  }

  if (updateFields.length === 0) {
    throw new Error('No updates provided');
  }

  updateFields.push(`updated_at = NOW()`);
  values.push(customReportId);

  const result = await client.query(
    `
      UPDATE shared.custom_reports
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `,
    values
  );

  return result.rows[0];
}

/**
 * Delete custom report
 */
export async function deleteCustomReport(
  client: PoolClient,
  customReportId: string,
  tenantId: string,
  userId?: string
): Promise<void> {
  const conditions: string[] = ['id = $1', 'tenant_id = $2'];
  const values: unknown[] = [customReportId, tenantId];
  let paramIndex = 3;

  // Only allow deletion of own reports unless user is admin
  if (userId) {
    conditions.push(`created_by = $${paramIndex++}`);
    values.push(userId);
  }

  const result = await client.query(
    `DELETE FROM shared.custom_reports WHERE ${conditions.join(' AND ')}`,
    values
  );

  if (result.rowCount === 0) {
    throw new Error('Custom report not found or unauthorized');
  }
}
