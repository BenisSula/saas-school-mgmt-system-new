import { Router } from 'express';
import crypto from 'crypto';
import authenticate from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/rbac';
import tenantResolver from '../../middleware/tenantResolver';
import { getPool } from '../../db/connection';
import {
  getReportDefinition,
  executeReport,
  getHistoricalTrend,
  compareWithHistory,
} from '../../services/reports/reportGenerationService';
import {
  createScheduledReport,
  getScheduledReports,
  updateScheduledReport,
  updateScheduledReportNextRun,
  deleteScheduledReport,
  getScheduledReportsReadyToRun,
} from '../../services/reports/reportSchedulingService';
import { generateExport, sendReportViaEmail } from '../../services/reports/reportExportService';
import {
  createCustomReport,
  executeCustomReport,
  getCustomReports,
  updateCustomReport,
  deleteCustomReport,
} from '../../services/reports/customReportBuilderService';
import { z } from 'zod';

const router = Router();

router.use(authenticate, tenantResolver({ optional: true }));

// Report Definitions
const createReportDefinitionSchema = z.object({
  tenantId: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  reportType: z.enum(['attendance', 'grades', 'fees', 'users', 'analytics', 'custom']),
  dataSource: z.string(),
  queryTemplate: z.string(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  columns: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
        label: z.string(),
      })
    )
    .optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  rolePermissions: z.array(z.string()).optional(),
});

router.post('/definitions', requirePermission('reports:manage'), async (req, res, next) => {
  try {
    const parsed = createReportDefinitionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `
          INSERT INTO shared.report_definitions (
            tenant_id, name, description, report_type, data_source,
            query_template, parameters, columns, filters, role_permissions, created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
        `,
        [
          parsed.data.tenantId || null,
          parsed.data.name,
          parsed.data.description || null,
          parsed.data.reportType,
          parsed.data.dataSource,
          parsed.data.queryTemplate,
          JSON.stringify(parsed.data.parameters || {}),
          JSON.stringify(parsed.data.columns || []),
          JSON.stringify(parsed.data.filters || {}),
          parsed.data.rolePermissions || [],
          req.user?.id || null,
        ]
      );
      res.status(201).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.get('/definitions', async (req, res, next) => {
  try {
    const tenantId = req.query.tenantId as string | undefined;
    const pool = getPool();
    const client = await pool.connect();
    try {
      const conditions: string[] = ['is_active = TRUE'];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (tenantId) {
        conditions.push(`(tenant_id = $${paramIndex++} OR tenant_id IS NULL)`);
        values.push(tenantId);
      }

      const result = await client.query(
        `
          SELECT * FROM shared.report_definitions
          WHERE ${conditions.join(' AND ')}
          ORDER BY created_at DESC
        `,
        values
      );
      res.json({ reports: result.rows });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.get('/definitions/:id', async (req, res, next) => {
  try {
    const tenantId = req.query.tenantId as string | undefined;
    const pool = getPool();
    const client = await pool.connect();
    try {
      const report = await getReportDefinition(client, req.params.id, tenantId);
      if (!report) {
        return res.status(404).json({ message: 'Report definition not found' });
      }
      res.json(report);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Execute Report
router.post(
  '/definitions/:id/execute',
  requirePermission('reports:view'),
  async (req, res, next) => {
    try {
      if (!req.tenant || !req.tenantClient) {
        return res.status(500).json({ message: 'Tenant context missing' });
      }

      const schema = z.object({
        parameters: z.record(z.string(), z.unknown()).optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.message });
      }

      const pool = getPool();
      const client = await pool.connect();
      try {
        const reportDefinition = await getReportDefinition(client, req.params.id, req.tenant.id);

        if (!reportDefinition) {
          return res.status(404).json({ message: 'Report definition not found' });
        }

        // Check role permissions
        if (reportDefinition.rolePermissions.length > 0) {
          const userRole = req.user?.role || '';
          if (!reportDefinition.rolePermissions.includes(userRole)) {
            return res.status(403).json({ message: 'Insufficient permissions' });
          }
        }

        const result = await executeReport(
          req.tenantClient,
          req.tenant.schema,
          reportDefinition,
          parsed.data.parameters,
          req.user?.id
        );

        res.json(result);
      } finally {
        client.release();
      }
    } catch (error) {
      next(error);
    }
  }
);

// Historical Trends
router.get('/definitions/:id/trends', requirePermission('reports:view'), async (req, res, next) => {
  try {
    if (!req.tenant) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }

    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    const pool = getPool();
    const client = await pool.connect();
    try {
      const trends = await getHistoricalTrend(client, req.tenant.id, req.params.id, days);
      res.json({ trends });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.post(
  '/definitions/:id/compare',
  requirePermission('reports:view'),
  async (req, res, next) => {
    try {
      if (!req.tenant || !req.tenantClient) {
        return res.status(500).json({ message: 'Tenant context missing' });
      }

      const schema = z.object({
        parameters: z.record(z.string(), z.unknown()).optional(),
        comparisonDays: z.number().int().min(1).max(365).optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.message });
      }

      const pool = getPool();
      const client = await pool.connect();
      try {
        const reportDefinition = await getReportDefinition(client, req.params.id, req.tenant.id);

        if (!reportDefinition) {
          return res.status(404).json({ message: 'Report definition not found' });
        }

        // Execute current report
        const currentResult = await executeReport(
          req.tenantClient,
          req.tenant.schema,
          reportDefinition,
          parsed.data.parameters,
          req.user?.id
        );

        // Compare with history
        const comparison = await compareWithHistory(
          client,
          req.tenant.id,
          req.params.id,
          currentResult.data,
          parsed.data.comparisonDays || 7
        );

        res.json({
          current: currentResult,
          comparison,
        });
      } finally {
        client.release();
      }
    } catch (error) {
      next(error);
    }
  }
);

// Scheduled Reports
router.post('/scheduled', requirePermission('reports:manage'), async (req, res, next) => {
  try {
    if (!req.tenant) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }

    const schema = z.object({
      reportDefinitionId: z.string().uuid(),
      name: z.string().min(1),
      scheduleType: z.enum(['daily', 'weekly', 'monthly', 'custom']),
      scheduleConfig: z.object({
        cron: z.string().optional(),
        dayOfWeek: z.number().int().min(0).max(6).optional(),
        dayOfMonth: z.number().int().min(1).max(31).optional(),
        time: z.string().optional(),
      }),
      parameters: z.record(z.string(), z.unknown()).optional(),
      exportFormat: z.enum(['csv', 'pdf', 'excel', 'json']),
      recipients: z.array(z.string().email()),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const scheduledReport = await createScheduledReport(client, {
        tenantId: req.tenant.id,
        ...parsed.data,
        createdBy: req.user?.id,
      });
      res.status(201).json(scheduledReport);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.get('/scheduled', requirePermission('reports:view'), async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      // For superusers without tenant context, show all scheduled reports
      // For users with tenant context, show only their tenant's reports
      if (req.tenant) {
        const scheduledReports = await getScheduledReports(client, req.tenant.id);
        res.json({ scheduledReports });
      } else {
        // Superuser view: get all scheduled reports across all tenants
        const result = await client.query(
          `
            SELECT sr.*, rd.name as report_name, rd.description as report_description
            FROM shared.scheduled_reports sr
            JOIN shared.report_definitions rd ON rd.id = sr.report_definition_id
            ORDER BY sr.created_at DESC
          `
        );
        res.json({ scheduledReports: result.rows });
      }
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.patch('/scheduled/:id', requirePermission('reports:manage'), async (req, res, next) => {
  try {
    if (!req.tenant) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }

    const schema = z.object({
      name: z.string().optional(),
      scheduleType: z.enum(['daily', 'weekly', 'monthly', 'custom']).optional(),
      scheduleConfig: z.record(z.string(), z.unknown()).optional(),
      parameters: z.record(z.string(), z.unknown()).optional(),
      exportFormat: z.enum(['csv', 'pdf', 'excel', 'json']).optional(),
      recipients: z.array(z.string().email()).optional(),
      isActive: z.boolean().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const scheduledReport = await updateScheduledReport(client, req.params.id, parsed.data);
      res.json(scheduledReport);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.delete('/scheduled/:id', requirePermission('reports:manage'), async (req, res, next) => {
  try {
    if (!req.tenant) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      await deleteScheduledReport(client, req.params.id, req.tenant.id);
      res.status(204).send();
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Process scheduled reports (cron endpoint)
router.post('/scheduled/process', requirePermission('tenants:manage'), async (_req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const readyReports = (await getScheduledReportsReadyToRun(client, 10)) as Array<{
        id: string;
        report_definition_id: string;
        tenant_id: string;
        parameters?: Record<string, unknown>;
        created_by?: string;
        recipients: string[];
        export_format: string;
      }>;
      const results = [];

      // OPTIMIZED: Batch fetch tenant schemas to avoid N+1 queries
      const tenantIds = [...new Set(readyReports.map((r) => r.tenant_id))];
      const tenantSchemasResult = await client.query(
        `SELECT id, schema_name FROM shared.tenants WHERE id = ANY($1::uuid[])`,
        [tenantIds]
      );
      const tenantSchemasMap = new Map(
        tenantSchemasResult.rows.map((row) => [row.id, row.schema_name])
      );

      // OPTIMIZED: Batch fetch report definitions to avoid N+1 queries
      const reportDefinitionIds = [...new Set(readyReports.map((r) => r.report_definition_id))];
      const reportDefinitionsResult = await client.query(
        `SELECT id, tenant_id, definition FROM shared.report_definitions WHERE id = ANY($1::uuid[])`,
        [reportDefinitionIds]
      );
      const reportDefinitionsMap = new Map(
        reportDefinitionsResult.rows.map((row) => [row.id, row])
      );

      for (const scheduledReport of readyReports) {
        try {
          // Get report definition from batch
          const reportDefinition = reportDefinitionsMap.get(scheduledReport.report_definition_id);
          if (!reportDefinition || reportDefinition.tenant_id !== scheduledReport.tenant_id) {
            continue;
          }

          // Get tenant schema from batch
          const tenantSchema = tenantSchemasMap.get(scheduledReport.tenant_id);
          if (!tenantSchema) {
            continue;
          }
          const tenantClient = await pool.connect();

          try {
            await tenantClient.query(`SET search_path TO ${tenantSchema}`);

            const executionResult = await executeReport(
              tenantClient,
              tenantSchema,
              reportDefinition,
              scheduledReport.parameters || {},
              scheduledReport.created_by
            );

            // Generate export and send email
            await sendReportViaEmail(
              client,
              executionResult.executionId,
              scheduledReport.recipients,
              scheduledReport.export_format as 'csv' | 'pdf' | 'excel' | 'json',
              scheduledReport.tenant_id
            );

            // Update next run time
            await updateScheduledReportNextRun(client, scheduledReport.id);

            results.push({ id: scheduledReport.id, status: 'success' });
          } finally {
            tenantClient.release();
          }
        } catch (error) {
          results.push({
            id: scheduledReport.id,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      res.json({ processed: results.length, results });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Custom Reports
router.post('/custom', requirePermission('reports:manage'), async (req, res, next) => {
  try {
    const isSuperuser = req.user?.role === 'superadmin';

    // For superusers, tenant context is optional (they can create platform-wide reports)
    // For regular users, tenant context is required
    if (!isSuperuser && (!req.tenant || !req.tenantClient)) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }

    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      baseTemplateId: z.string().uuid().optional(),
      dataSources: z.array(z.string()).min(1),
      joins: z
        .array(
          z.object({
            type: z.enum(['inner', 'left', 'right', 'full']),
            table: z.string(),
            on: z.string(),
          })
        )
        .optional(),
      selectedColumns: z
        .array(
          z.object({
            table: z.string(),
            column: z.string(),
            alias: z.string().optional(),
            aggregate: z.enum(['sum', 'avg', 'count', 'min', 'max']).optional(),
          })
        )
        .min(1),
      filters: z
        .array(
          z.object({
            column: z.string(),
            operator: z.enum(['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'BETWEEN']),
            value: z.unknown(),
          })
        )
        .optional(),
      groupBy: z.array(z.string()).optional(),
      orderBy: z
        .array(
          z.object({
            column: z.string(),
            direction: z.enum(['ASC', 'DESC']),
          })
        )
        .optional(),
      visualizationType: z.enum(['table', 'bar', 'line', 'pie', 'area']).optional(),
      rolePermissions: z.array(z.string()).optional(),
      isShared: z.boolean().optional(),
      tenantId: z.string().uuid().optional(), // Allow superusers to specify tenant
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      // For superusers without tenant context, use a default schema or handle differently
      if (isSuperuser && !req.tenant) {
        // Superuser creating a platform-wide report - store with tenant_id = null
        // We'll need to handle execution differently for these
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
            parsed.data.tenantId || null,
            parsed.data.name,
            parsed.data.description || null,
            parsed.data.baseTemplateId || null,
            parsed.data.dataSources,
            JSON.stringify(parsed.data.joins || []),
            JSON.stringify(parsed.data.selectedColumns),
            JSON.stringify(parsed.data.filters || []),
            parsed.data.groupBy || [],
            JSON.stringify(parsed.data.orderBy || []),
            JSON.stringify(
              parsed.data.selectedColumns
                .filter((col) => col.aggregate)
                .map((col) => ({ column: col.column, aggregate: col.aggregate }))
            ),
            parsed.data.visualizationType || 'table',
            parsed.data.rolePermissions || [],
            parsed.data.isShared || false,
            req.user?.id || null,
          ]
        );
        res.status(201).json(result.rows[0]);
      } else {
        // Regular user or superuser with tenant context
        const customReport = await createCustomReport(req.tenantClient!, req.tenant!.schema, {
          tenantId: req.tenant!.id,
          ...parsed.data,
          createdBy: req.user?.id,
        });
        res.status(201).json(customReport);
      }
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.get('/custom', requirePermission('reports:view'), async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      // For superusers without tenant context, show all custom reports
      // For users with tenant context, show only their tenant's reports
      if (req.tenant) {
        const customReports = await getCustomReports(client, req.tenant.id, req.user?.id);
        res.json({ customReports });
      } else {
        // Superuser view: get all custom reports across all tenants
        const result = await client.query(
          `
            SELECT * FROM shared.custom_reports
            WHERE is_shared = TRUE OR created_by = $1
            ORDER BY created_at DESC
          `,
          [req.user?.id || null]
        );
        res.json({ customReports: result.rows });
      }
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.post('/custom/:id/execute', requirePermission('reports:view'), async (req, res, next) => {
  try {
    const isSuperuser = req.user?.role === 'superadmin';
    const pool = getPool();
    const client = await pool.connect();

    try {
      // Get the custom report to check tenant_id
      const reportResult = await client.query('SELECT * FROM shared.custom_reports WHERE id = $1', [
        req.params.id,
      ]);

      if (reportResult.rowCount === 0) {
        return res.status(404).json({ message: 'Custom report not found' });
      }

      const report = reportResult.rows[0];

      // If report has tenant_id, we need tenant context
      if (report.tenant_id) {
        if (!req.tenant || !req.tenantClient) {
          return res.status(500).json({ message: 'Tenant context required for this report' });
        }

        const result = await executeCustomReport(
          req.tenantClient,
          req.tenant.schema,
          req.params.id
        );

        const executionId = crypto.randomUUID();

        res.json({
          executionId,
          data: result.data,
          columns: result.columns,
          rowCount: result.rowCount,
          executionTimeMs: 0,
        });
      } else {
        // Platform-wide report (tenant_id is null) - superuser only
        if (!isSuperuser) {
          return res
            .status(403)
            .json({ message: 'Only superusers can execute platform-wide reports' });
        }

        // For platform-wide reports, we need to determine which schema to use
        // For now, we'll require a tenant context or use a default
        // In the future, this could execute across all tenants
        if (!req.tenant || !req.tenantClient) {
          return res.status(400).json({
            message:
              'Platform-wide reports require tenant context for execution. Please specify a tenant.',
          });
        }

        const result = await executeCustomReport(
          req.tenantClient,
          req.tenant.schema,
          req.params.id
        );

        const executionId = crypto.randomUUID();

        res.json({
          executionId,
          data: result.data,
          columns: result.columns,
          rowCount: result.rowCount,
          executionTimeMs: 0,
        });
      }
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.patch('/custom/:id', requirePermission('reports:manage'), async (req, res, next) => {
  try {
    if (!req.tenant || !req.tenantClient) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }

    const schema = z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      selectedColumns: z
        .array(
          z.object({
            table: z.string(),
            column: z.string(),
            alias: z.string().optional(),
            aggregate: z.enum(['sum', 'avg', 'count', 'min', 'max']).optional(),
          })
        )
        .optional(),
      filters: z
        .array(
          z.object({
            column: z.string(),
            operator: z.enum(['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'BETWEEN']),
            value: z.unknown(),
          })
        )
        .optional(),
      groupBy: z.array(z.string()).optional(),
      orderBy: z
        .array(
          z.object({
            column: z.string(),
            direction: z.enum(['ASC', 'DESC']),
          })
        )
        .optional(),
      visualizationType: z.enum(['table', 'bar', 'line', 'pie', 'area']).optional(),
      isShared: z.boolean().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const customReport = await updateCustomReport(
        req.tenantClient,
        req.tenant.schema,
        req.params.id,
        parsed.data
      );
      res.json(customReport);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.delete('/custom/:id', requirePermission('reports:manage'), async (req, res, next) => {
  try {
    if (!req.tenant) {
      return res.status(500).json({ message: 'Tenant context missing' });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      await deleteCustomReport(client, req.params.id, req.tenant.id, req.user?.id);
      res.status(204).send();
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Export Reports
router.post('/executions/:id/export', requirePermission('reports:view'), async (req, res, next) => {
  try {
    const schema = z.object({
      format: z.enum(['csv', 'pdf', 'excel', 'json']),
      title: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const exportResult = await generateExport(
        client,
        req.params.id,
        parsed.data.format,
        parsed.data.title
      );
      res.json(exportResult);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.post(
  '/executions/:id/email',
  requirePermission('reports:manage'),
  async (req, res, next) => {
    try {
      if (!req.tenant) {
        return res.status(500).json({ message: 'Tenant context missing' });
      }

      const schema = z.object({
        recipients: z.array(z.string().email()),
        format: z.enum(['csv', 'pdf', 'excel', 'json']).optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.message });
      }

      const pool = getPool();
      const client = await pool.connect();
      try {
        await sendReportViaEmail(
          client,
          req.params.id,
          parsed.data.recipients,
          parsed.data.format || 'pdf',
          req.tenant.id
        );
        res.json({ success: true });
      } finally {
        client.release();
      }
    } catch (error) {
      next(error);
    }
  }
);

export default router;
