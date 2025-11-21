import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import authorizeSuperUser from '../../middleware/authorizeSuperUser';
import { getPool } from '../../db/connection';
import {
  getPlatformAuditLogs,
  getLoginAttempts
} from '../../services/superuser/platformAuditService';
import { exportAuditLogs } from '../../services/audit/enhancedAuditService';
import {
  auditLogsQuerySchema,
  auditLogsExportQuerySchema
} from '../../validators/superuserAuditValidator';
import { Role } from '../../config/permissions';

const router = Router();

// All routes require authentication and superuser authorization
router.use(authenticate, authorizeSuperUser);

/**
 * GET /superuser/audit-logs
 * Get platform-wide audit logs
 */
router.get('/audit-logs', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      const queryResult = auditLogsQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        return res.status(400).json({ message: queryResult.error.message });
      }

      const filters = {
        tenantId: queryResult.data.tenantId,
        userId: queryResult.data.userId,
        action: queryResult.data.action,
        resourceType: queryResult.data.resourceType,
        resourceId: queryResult.data.resourceId,
        severity: queryResult.data.severity,
        tags: queryResult.data.tags,
        startDate: queryResult.data.startDate,
        endDate: queryResult.data.endDate,
        limit: queryResult.data.limit || 50,
        offset: queryResult.data.offset || 0
      };

      const result = await getPlatformAuditLogs(
        client,
        filters,
        req.user!.role as Role
      );

      res.json(result);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /superuser/audit-logs/export
 * Export audit logs in CSV or JSON format
 */
router.get('/audit-logs/export', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      const queryResult = auditLogsExportQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        return res.status(400).json({ message: queryResult.error.message });
      }

      const filters = {
        tenantId: queryResult.data.tenantId,
        userId: queryResult.data.userId,
        action: queryResult.data.action,
        resourceType: queryResult.data.resourceType,
        resourceId: queryResult.data.resourceId,
        severity: queryResult.data.severity,
        tags: queryResult.data.tags,
        startDate: queryResult.data.startDate,
        endDate: queryResult.data.endDate,
        limit: 10000 // Large limit for exports
      };

      const format = queryResult.data.format || 'json';
      const exportData = await exportAuditLogs(client, filters, format);

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
        res.send(exportData);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.json"');
        res.json(JSON.parse(exportData));
      }
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /superuser/audit-logs/school/:schoolId
 * Get school-level audit logs
 */
router.get('/audit-logs/school/:schoolId', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      const queryResult = auditLogsQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        return res.status(400).json({ message: queryResult.error.message });
      }

      const filters = {
        tenantId: req.params.schoolId,
        userId: queryResult.data.userId,
        action: queryResult.data.action,
        resourceType: queryResult.data.resourceType,
        resourceId: queryResult.data.resourceId,
        severity: queryResult.data.severity,
        tags: queryResult.data.tags,
        startDate: queryResult.data.startDate,
        endDate: queryResult.data.endDate,
        limit: queryResult.data.limit || 50,
        offset: queryResult.data.offset || 0
      };

      const result = await getPlatformAuditLogs(
        client,
        filters,
        req.user!.role as Role
      );
      res.json(result);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /superuser/audit-logs/stats
 * Get audit log statistics
 */
router.get('/audit-logs/stats', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      const schoolId = req.query.schoolId as string | undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      let whereConditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;
      
      if (schoolId) {
        whereConditions.push(`tenant_id = $${paramIndex++}`);
        params.push(schoolId);
      }
      
      if (startDate) {
        whereConditions.push(`created_at >= $${paramIndex++}`);
        params.push(startDate);
      }
      
      if (endDate) {
        whereConditions.push(`created_at <= $${paramIndex++}`);
        params.push(endDate);
      }
      
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      
      // Get total count
      const totalResult = await client.query(
        `SELECT COUNT(*) as total FROM shared.audit_logs ${whereClause}`,
        params
      );
      const total = parseInt(totalResult.rows[0].total, 10);
      
      // Get count by severity
      const severityResult = await client.query(
        `SELECT severity, COUNT(*) as count FROM shared.audit_logs ${whereClause} GROUP BY severity`,
        params
      );
      const bySeverity: Record<string, number> = {};
      severityResult.rows.forEach(row => {
        bySeverity[row.severity] = parseInt(row.count, 10);
      });
      
      // Get count by action type (top 10)
      const actionResult = await client.query(
        `SELECT action, COUNT(*) as count FROM shared.audit_logs ${whereClause} GROUP BY action ORDER BY count DESC LIMIT 10`,
        params
      );
      const byAction: Record<string, number> = {};
      actionResult.rows.forEach(row => {
        byAction[row.action] = parseInt(row.count, 10);
      });
      
      res.json({
        total,
        bySeverity,
        byAction,
        period: {
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString()
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /superuser/login-attempts
 * Get login attempts (successful and failed)
 */
router.get('/login-attempts', async (req, res, next) => {
  try {
    const pool = getPool();
    
    // Parse query parameters
    const filters: {
      email?: string;
      userId?: string;
      tenantId?: string | null;
      success?: boolean;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {};
    
    if (req.query.email && typeof req.query.email === 'string') {
      filters.email = req.query.email;
    }
    if (req.query.userId && typeof req.query.userId === 'string') {
      filters.userId = req.query.userId;
    }
    if (req.query.tenantId !== undefined) {
      filters.tenantId = req.query.tenantId === 'null' || req.query.tenantId === '' ? null : req.query.tenantId as string;
    }
    if (req.query.success !== undefined) {
      filters.success = req.query.success === 'true';
    }
    if (req.query.startDate && typeof req.query.startDate === 'string') {
      filters.startDate = new Date(req.query.startDate);
    }
    if (req.query.endDate && typeof req.query.endDate === 'string') {
      filters.endDate = new Date(req.query.endDate);
    }
    if (req.query.limit) {
      filters.limit = parseInt(req.query.limit as string, 10);
    }
    if (req.query.offset) {
      filters.offset = parseInt(req.query.offset as string, 10);
    }
    
    const result = await getLoginAttempts(
      pool,
      filters,
      req.user!.role as Role
    );
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /superuser/audit-logs/detail/:id
 * Get full details of a specific audit log entry
 */
router.get('/audit-logs/detail/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      const { id } = req.params;
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ message: 'Invalid audit log ID' });
      }
      
      // Get full audit log entry
      const result = await client.query(
        `
          SELECT 
            id, tenant_id, user_id, action, resource_type, resource_id,
            details, ip_address, user_agent, request_id, severity, tags,
            created_at
          FROM shared.audit_logs
          WHERE id = $1
        `,
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Audit log not found' });
      }
      
      const row = result.rows[0];
      
      // Map to AuditLogEntry format
      const auditLog = {
        id: row.id,
        tenantId: row.tenant_id,
        userId: row.user_id,
        action: row.action,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        details: row.details,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        requestId: row.request_id,
        severity: row.severity,
        tags: row.tags || [],
        createdAt: row.created_at
      };
      
      res.json(auditLog);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

export default router;

