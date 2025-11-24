import { Pool } from 'pg';
import { requireSuperuser } from '../../lib/superuserHelpers';
import { Role } from '../../config/permissions';
import { createAuditLog, AuditLogEntry } from '../audit/enhancedAuditService';
import { getLoginAttempts } from './platformAuditService';
import { getPlatformActiveSessions } from './sessionService';
import { getPlatformAuditLogs } from './platformAuditService';

export interface InvestigationCase {
  id: string;
  caseNumber: string;
  title: string;
  description?: string | null;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  caseType: 'anomaly' | 'security' | 'compliance' | 'abuse' | 'other';
  relatedUserId?: string | null;
  relatedTenantId?: string | null;
  assignedTo?: string | null;
  createdBy: string;
  resolvedBy?: string | null;
  openedAt: Date;
  investigatedAt?: Date | null;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
  resolution?: string | null;
  resolutionNotes?: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CaseNote {
  id: string;
  caseId: string;
  note: string;
  noteType: 'note' | 'finding' | 'evidence' | 'action';
  createdBy: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

export interface CaseEvidence {
  id: string;
  caseId: string;
  evidenceType: 'audit_log' | 'session' | 'login_attempt' | 'password_change' | 'file' | 'other';
  evidenceId: string;
  evidenceSource?: string | null;
  description?: string | null;
  addedBy: string;
  addedAt: Date;
  metadata: Record<string, unknown>;
}

export interface AnomalyDetectionResult {
  type: 'failed_logins' | 'multiple_ips' | 'unusual_activity' | 'suspicious_pattern';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  userId?: string;
  userEmail?: string;
  tenantId?: string | null;
  evidence: Array<{
    type: string;
    id: string;
    timestamp: Date;
    details: Record<string, unknown>;
  }>;
  detectedAt: Date;
}

export interface CaseFilters {
  status?: 'open' | 'investigating' | 'resolved' | 'closed';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  caseType?: 'anomaly' | 'security' | 'compliance' | 'abuse' | 'other';
  relatedUserId?: string;
  relatedTenantId?: string | null;
  assignedTo?: string;
  createdBy?: string;
  tags?: string[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Create a new investigation case
 */
export async function createInvestigationCase(
  pool: Pool,
  input: {
    title: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    caseType: 'anomaly' | 'security' | 'compliance' | 'abuse' | 'other';
    relatedUserId?: string;
    relatedTenantId?: string | null;
    assignedTo?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  },
  createdBy: string,
  requesterRole: Role
): Promise<InvestigationCase> {
  requireSuperuser(requesterRole);

  const result = await pool.query(
    `
      INSERT INTO shared.investigation_cases (
        title, description, priority, case_type,
        related_user_id, related_tenant_id, assigned_to,
        created_by, tags, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      RETURNING *
    `,
    [
      input.title,
      input.description || null,
      input.priority || 'medium',
      input.caseType,
      input.relatedUserId || null,
      input.relatedTenantId || null,
      input.assignedTo || null,
      createdBy,
      input.tags || [],
      JSON.stringify(input.metadata || {}),
    ]
  );

  const case_ = mapCaseRow(result.rows[0]);

  // Audit log
  const client = await pool.connect();
  try {
    await createAuditLog(client, {
      tenantId: undefined,
      userId: createdBy,
      action: 'INVESTIGATION_CASE_CREATED',
      resourceType: 'INVESTIGATION_CASE',
      resourceId: case_.id,
      details: {
        caseNumber: case_.caseNumber,
        title: case_.title,
        caseType: case_.caseType,
        priority: case_.priority,
      },
      severity: 'info',
      tags: ['investigation', 'security'],
    });
  } finally {
    client.release();
  }

  return case_;
}

/**
 * Update investigation case status
 */
export async function updateCaseStatus(
  pool: Pool,
  caseId: string,
  status: 'open' | 'investigating' | 'resolved' | 'closed',
  updatedBy: string,
  requesterRole: Role,
  resolution?: string,
  resolutionNotes?: string
): Promise<InvestigationCase> {
  requireSuperuser(requesterRole);

  const updateFields: string[] = ['status = $1', 'updated_at = NOW()'];
  const values: unknown[] = [status];
  let paramIndex = 2;

  if (status === 'investigating') {
    updateFields.push(`investigated_at = NOW()`);
  }

  if (status === 'resolved') {
    updateFields.push(`resolved_at = NOW()`);
    updateFields.push(`resolved_by = $${paramIndex++}`);
    values.push(updatedBy);
    if (resolution) {
      updateFields.push(`resolution = $${paramIndex++}`);
      values.push(resolution);
    }
    if (resolutionNotes) {
      updateFields.push(`resolution_notes = $${paramIndex++}`);
      values.push(resolutionNotes);
    }
  }

  if (status === 'closed') {
    updateFields.push(`closed_at = NOW()`);
  }

  const result = await pool.query(
    `
      UPDATE shared.investigation_cases
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `,
    [...values, caseId]
  );

  if (result.rows.length === 0) {
    throw new Error('Case not found');
  }

  return mapCaseRow(result.rows[0]);
}

/**
 * Get investigation cases with filters
 */
export async function getInvestigationCases(
  pool: Pool,
  filters: CaseFilters,
  requesterRole: Role
): Promise<{ cases: InvestigationCase[]; total: number }> {
  requireSuperuser(requesterRole);

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.status) {
    conditions.push(`status = $${paramIndex++}`);
    values.push(filters.status);
  }
  if (filters.priority) {
    conditions.push(`priority = $${paramIndex++}`);
    values.push(filters.priority);
  }
  if (filters.caseType) {
    conditions.push(`case_type = $${paramIndex++}`);
    values.push(filters.caseType);
  }
  if (filters.relatedUserId) {
    conditions.push(`related_user_id = $${paramIndex++}`);
    values.push(filters.relatedUserId);
  }
  if (filters.relatedTenantId !== undefined) {
    if (filters.relatedTenantId === null) {
      conditions.push(`related_tenant_id IS NULL`);
    } else {
      conditions.push(`related_tenant_id = $${paramIndex++}`);
      values.push(filters.relatedTenantId);
    }
  }
  if (filters.assignedTo) {
    conditions.push(`assigned_to = $${paramIndex++}`);
    values.push(filters.assignedTo);
  }
  if (filters.createdBy) {
    conditions.push(`created_by = $${paramIndex++}`);
    values.push(filters.createdBy);
  }
  if (filters.tags && filters.tags.length > 0) {
    conditions.push(`tags && $${paramIndex++}`);
    values.push(filters.tags);
  }
  if (filters.startDate) {
    conditions.push(`opened_at >= $${paramIndex++}`);
    values.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push(`opened_at <= $${paramIndex++}`);
    values.push(filters.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM shared.investigation_cases ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get cases
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  const limitValues = [...values, limit, offset];

  const casesResult = await pool.query(
    `
      SELECT * FROM shared.investigation_cases
      ${whereClause}
      ORDER BY opened_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `,
    limitValues
  );

  return {
    cases: casesResult.rows.map(mapCaseRow),
    total,
  };
}

/**
 * Get a single investigation case with notes and evidence
 */
export async function getInvestigationCase(
  pool: Pool,
  caseId: string,
  requesterRole: Role
): Promise<{
  case: InvestigationCase;
  notes: CaseNote[];
  evidence: CaseEvidence[];
}> {
  requireSuperuser(requesterRole);

  const caseResult = await pool.query(`SELECT * FROM shared.investigation_cases WHERE id = $1`, [
    caseId,
  ]);

  if (caseResult.rows.length === 0) {
    throw new Error('Case not found');
  }

  const notesResult = await pool.query(
    `SELECT * FROM shared.investigation_case_notes WHERE case_id = $1 ORDER BY created_at DESC`,
    [caseId]
  );

  const evidenceResult = await pool.query(
    `SELECT * FROM shared.investigation_case_evidence WHERE case_id = $1 ORDER BY added_at DESC`,
    [caseId]
  );

  return {
    case: mapCaseRow(caseResult.rows[0]),
    notes: notesResult.rows.map(mapNoteRow),
    evidence: evidenceResult.rows.map(mapEvidenceRow),
  };
}

/**
 * Add a note to an investigation case
 */
export async function addCaseNote(
  pool: Pool,
  caseId: string,
  note: string,
  noteType: 'note' | 'finding' | 'evidence' | 'action',
  createdBy: string,
  requesterRole: Role,
  metadata?: Record<string, unknown>
): Promise<CaseNote> {
  requireSuperuser(requesterRole);

  const result = await pool.query(
    `
      INSERT INTO shared.investigation_case_notes (
        case_id, note, note_type, created_by, metadata
      )
      VALUES ($1, $2, $3, $4, $5::jsonb)
      RETURNING *
    `,
    [caseId, note, noteType, createdBy, JSON.stringify(metadata || {})]
  );

  return mapNoteRow(result.rows[0]);
}

/**
 * Add evidence to an investigation case
 */
export async function addCaseEvidence(
  pool: Pool,
  caseId: string,
  evidenceType: 'audit_log' | 'session' | 'login_attempt' | 'password_change' | 'file' | 'other',
  evidenceId: string,
  evidenceSource: string,
  description: string,
  addedBy: string,
  requesterRole: Role,
  metadata?: Record<string, unknown>
): Promise<CaseEvidence> {
  requireSuperuser(requesterRole);

  const result = await pool.query(
    `
      INSERT INTO shared.investigation_case_evidence (
        case_id, evidence_type, evidence_id, evidence_source,
        description, added_by, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING *
    `,
    [
      caseId,
      evidenceType,
      evidenceId,
      evidenceSource,
      description,
      addedBy,
      JSON.stringify(metadata || {}),
    ]
  );

  return mapEvidenceRow(result.rows[0]);
}

/**
 * Detect behavioral anomalies
 */
export async function detectAnomalies(
  pool: Pool,
  filters: {
    userId?: string;
    tenantId?: string | null;
    startDate?: Date;
    endDate?: Date;
  },
  requesterRole: Role
): Promise<AnomalyDetectionResult[]> {
  requireSuperuser(requesterRole);

  const anomalies: AnomalyDetectionResult[] = [];

  // 1. Detect multiple failed login attempts
  const loginAttemptsResult = await getLoginAttempts(
    pool,
    {
      userId: filters.userId,
      tenantId: filters.tenantId,
      success: false,
      startDate: filters.startDate,
      endDate: filters.endDate,
      limit: 1000,
    },
    requesterRole
  );

  // Group by email/userId
  const failedAttemptsByUser = new Map<string, typeof loginAttemptsResult.attempts>();
  loginAttemptsResult.attempts.forEach((attempt) => {
    const key = attempt.userId || attempt.email;
    if (!failedAttemptsByUser.has(key)) {
      failedAttemptsByUser.set(key, []);
    }
    failedAttemptsByUser.get(key)!.push(attempt);
  });

  // Flag users with 5+ failed attempts
  failedAttemptsByUser.forEach((attempts) => {
    if (attempts.length >= 5) {
      anomalies.push({
        type: 'failed_logins',
        severity: attempts.length >= 10 ? 'high' : attempts.length >= 7 ? 'medium' : 'low',
        description: `${attempts.length} failed login attempts detected`,
        userId: attempts[0].userId || undefined,
        userEmail: attempts[0].email,
        tenantId: attempts[0].tenantId || null,
        evidence: attempts.slice(0, 10).map((a) => ({
          type: 'login_attempt',
          id: a.id,
          timestamp: new Date(a.attemptedAt),
          details: {
            email: a.email,
            ipAddress: a.ipAddress,
            failureReason: a.failureReason,
          },
        })),
        detectedAt: new Date(),
      });
    }
  });

  // 2. Detect multiple IP logins for same user
  const sessionsResult = await getPlatformActiveSessions(
    pool,
    {
      userId: filters.userId,
      tenantId: filters.tenantId,
      limit: 1000,
    },
    requesterRole
  );

  const sessionsByUser = new Map<string, typeof sessionsResult.sessions>();
  sessionsResult.sessions.forEach((session) => {
    if (!sessionsByUser.has(session.userId)) {
      sessionsByUser.set(session.userId, []);
    }
    sessionsByUser.get(session.userId)!.push(session);
  });

  sessionsByUser.forEach((sessions, userId) => {
    const uniqueIPs = new Set(sessions.map((s) => s.ipAddress).filter(Boolean));
    if (uniqueIPs.size >= 3) {
      anomalies.push({
        type: 'multiple_ips',
        severity: uniqueIPs.size >= 5 ? 'high' : 'medium',
        description: `User logged in from ${uniqueIPs.size} different IP addresses`,
        userId,
        tenantId: sessions[0].tenantId,
        evidence: sessions.slice(0, 10).map((s) => ({
          type: 'session',
          id: s.id,
          timestamp: s.loginAt,
          details: {
            ipAddress: s.ipAddress,
            userAgent: s.userAgent,
            loginAt: s.loginAt,
          },
        })),
        detectedAt: new Date(),
      });
    }
  });

  // 3. Detect unusual activity patterns from audit logs
  const client = await pool.connect();
  try {
    const auditLogsResult = await getPlatformAuditLogs(
      client,
      {
        userId: filters.userId,
        tenantId: filters.tenantId === null ? undefined : filters.tenantId,
        severity: 'warning',
        startDate: filters.startDate,
        endDate: filters.endDate,
        limit: 100,
      },
      requesterRole
    );

    if (auditLogsResult.logs.length >= 10) {
      anomalies.push({
        type: 'unusual_activity',
        severity: auditLogsResult.logs.length >= 20 ? 'high' : 'medium',
        description: `${auditLogsResult.logs.length} warning-level events detected`,
        userId: filters.userId,
        tenantId: filters.tenantId || null,
        evidence: auditLogsResult.logs.slice(0, 10).map((log) => ({
          type: 'audit_log',
          id: log.id,
          timestamp: log.createdAt,
          details: {
            action: log.action,
            severity: log.severity,
            resourceType: log.resourceType,
          },
        })),
        detectedAt: new Date(),
      });
    }
  } finally {
    client.release();
  }

  return anomalies;
}

/**
 * Get all actions performed by a user (cross-tenant)
 */
export async function getUserActions(
  pool: Pool,
  userId: string,
  filters: {
    tenantId?: string | null;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  },
  requesterRole: Role
): Promise<{ actions: AuditLogEntry[]; total: number }> {
  requireSuperuser(requesterRole);

  const client = await pool.connect();
  try {
    const auditLogsResult = await getPlatformAuditLogs(
      client,
      {
        userId,
        tenantId: filters.tenantId === null ? undefined : filters.tenantId,
        startDate: filters.startDate,
        endDate: filters.endDate,
        limit: filters.limit || 100,
        offset: filters.offset || 0,
      },
      requesterRole
    );

    return {
      actions: auditLogsResult.logs,
      total: auditLogsResult.total,
    };
  } finally {
    client.release();
  }
}

/**
 * Export audit trail for a case
 */
export async function exportCaseAuditTrail(
  pool: Pool,
  caseId: string,
  format: 'csv' | 'pdf' | 'json',
  requesterRole: Role
): Promise<{ data: string; filename: string; mimeType: string }> {
  requireSuperuser(requesterRole);

  const caseData = await getInvestigationCase(pool, caseId, requesterRole);
  const client = await pool.connect();

  try {
    // Get all audit logs related to this case
    const auditLogs: AuditLogEntry[] = [];

    for (const evidence of caseData.evidence) {
      if (evidence.evidenceType === 'audit_log') {
        const logResult = await client.query(`SELECT * FROM shared.audit_logs WHERE id = $1`, [
          evidence.evidenceId,
        ]);
        if (logResult.rows.length > 0) {
          const row = logResult.rows[0];
          auditLogs.push({
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
            tags: row.tags,
            createdAt: row.created_at,
          });
        }
      }
    }

    // Also get audit logs for related user/tenant
    if (caseData.case.relatedUserId) {
      const userLogsResult = await getPlatformAuditLogs(
        client,
        {
          userId: caseData.case.relatedUserId,
          tenantId: caseData.case.relatedTenantId || undefined,
          limit: 1000,
        },
        requesterRole
      );
      auditLogs.push(...userLogsResult.logs);
    }

    // Format based on requested format
    if (format === 'json') {
      return {
        data: JSON.stringify(
          {
            case: caseData.case,
            notes: caseData.notes,
            evidence: caseData.evidence,
            auditLogs,
          },
          null,
          2
        ),
        filename: `${caseData.case.caseNumber}-audit-trail.json`,
        mimeType: 'application/json',
      };
    } else if (format === 'csv') {
      // Convert to CSV
      const csvRows: string[] = [];
      csvRows.push('Timestamp,Action,User,IP Address,Resource Type,Resource ID,Severity,Details');

      auditLogs.forEach((log) => {
        const timestamp = log.createdAt ? log.createdAt.toISOString() : '';
        const action = log.action || '';
        const user = log.userId || '';
        const ip = log.ipAddress || '';
        const resourceType = log.resourceType || '';
        const resourceId = log.resourceId || '';
        const severity = log.severity || '';
        const details = JSON.stringify(log.details || {}).replace(/"/g, '""');
        csvRows.push(
          `"${timestamp}","${action}","${user}","${ip}","${resourceType}","${resourceId}","${severity}","${details}"`
        );
      });

      return {
        data: csvRows.join('\n'),
        filename: `${caseData.case.caseNumber}-audit-trail.csv`,
        mimeType: 'text/csv',
      };
    } else {
      // PDF - for now, return JSON (PDF generation would require a library like pdfkit)
      throw new Error('PDF export not yet implemented');
    }
  } finally {
    client.release();
  }
}

// Helper functions to map database rows
function mapCaseRow(row: {
  id: string;
  case_number: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  case_type: string;
  related_user_id: string | null;
  related_tenant_id: string | null;
  assigned_to: string | null;
  created_by: string;
  resolved_by: string | null;
  opened_at: Date;
  investigated_at: Date | null;
  resolved_at: Date | null;
  closed_at: Date | null;
  resolution: string | null;
  resolution_notes: string | null;
  tags: string[];
  metadata: unknown;
  created_at: Date;
  updated_at: Date;
}): InvestigationCase {
  return {
    id: row.id,
    caseNumber: row.case_number,
    title: row.title,
    description: row.description,
    status: row.status as 'open' | 'investigating' | 'resolved' | 'closed',
    priority: row.priority as 'low' | 'medium' | 'high' | 'critical',
    caseType: row.case_type as 'anomaly' | 'security' | 'compliance' | 'abuse' | 'other',
    relatedUserId: row.related_user_id,
    relatedTenantId: row.related_tenant_id,
    assignedTo: row.assigned_to,
    createdBy: row.created_by,
    resolvedBy: row.resolved_by,
    openedAt: row.opened_at,
    investigatedAt: row.investigated_at,
    resolvedAt: row.resolved_at,
    closedAt: row.closed_at,
    resolution: row.resolution,
    resolutionNotes: row.resolution_notes,
    tags: row.tags || [],
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapNoteRow(row: {
  id: string;
  case_id: string;
  note: string;
  note_type: string;
  created_by: string;
  created_at: Date;
  metadata: unknown;
}): CaseNote {
  return {
    id: row.id,
    caseId: row.case_id,
    note: row.note,
    noteType: row.note_type as 'note' | 'finding' | 'evidence' | 'action',
    createdBy: row.created_by,
    createdAt: row.created_at,
    metadata: (row.metadata as Record<string, unknown>) || {},
  };
}

function mapEvidenceRow(row: {
  id: string;
  case_id: string;
  evidence_type: string;
  evidence_id: string;
  evidence_source: string | null;
  description: string | null;
  added_by: string;
  added_at: Date;
  metadata: unknown;
}): CaseEvidence {
  return {
    id: row.id,
    caseId: row.case_id,
    evidenceType: row.evidence_type as
      | 'audit_log'
      | 'session'
      | 'login_attempt'
      | 'password_change'
      | 'file'
      | 'other',
    evidenceId: row.evidence_id,
    evidenceSource: row.evidence_source,
    description: row.description,
    addedBy: row.added_by,
    addedAt: row.added_at,
    metadata: (row.metadata as Record<string, unknown>) || {},
  };
}
