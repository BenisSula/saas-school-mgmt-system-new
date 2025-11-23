import crypto from 'crypto';
import type { PoolClient } from 'pg';
import { getPool } from '../db/connection';
import { assertValidSchemaName, withTenantSearchPath } from '../db/tenantManager';
import { logger } from '../lib/logger';

export const AUDIT_ENTITY_TYPES = [
  'SUBJECT',
  'CLASS',
  'ENROLLMENT',
  'STUDENT',
  'TEACHER_ASSIGNMENT',
  'SUBJECT_REQUEST',
  'ATTENDANCE',
  'EXAM',
  'GRADE',
  'INVOICE',
  'ACCESS',
  'TENANT',
  'USER',
  'USER_SESSION',
  'NOTIFICATION',
  'DEPARTMENT',
  'REPORT',
  'SETTINGS',
  'OVERRIDE',
  'PERMISSION_OVERRIDE',
  'SUBSCRIPTION'
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export interface AuditLogEntry {
  userId?: string | null;
  action: string;
  entityType: AuditEntityType;
  entityId?: string | null;
  details?: Record<string, unknown>;
  actorRole?: string | null;
  target?: string | null;
}

export interface AuditLogFilter {
  entityType?: AuditEntityType;
  userId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

export async function recordAuditLog(
  client: PoolClient,
  schema: string,
  entry: AuditLogEntry
): Promise<void> {
  assertValidSchemaName(schema);

  const normalizedUserId = entry.userId && UUID_REGEX.test(entry.userId) ? entry.userId : null;
  const id = crypto.randomUUID();

  try {
    await client.query(
      `
        INSERT INTO ${schema}.audit_logs (
          id,
          user_id,
          action,
          entity_type,
          entity_id,
          actor_role,
          target,
          details,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())
      `,
      [
        id,
        normalizedUserId,
        entry.action,
        entry.entityType,
        entry.entityId ?? null,
        entry.actorRole ?? null,
        entry.target ?? null,
        JSON.stringify(entry.details ?? {})
      ]
    );
  } catch (error) {
    logger.error(
      {
        err: error,
        auditAction: entry.action,
        auditEntity: entry.entityType,
        auditEntityId: entry.entityId
      },
      'Failed to record audit log'
    );
  }
}

export async function recordTenantAuditLog(schema: string, entry: AuditLogEntry): Promise<void> {
  const pool = getPool();
  await withTenantSearchPath(pool, schema, async (client) => {
    await recordAuditLog(client, schema, entry);
  });
}

export async function recordSharedAuditLog(entry: AuditLogEntry): Promise<void> {
  const pool = getPool();
  await pool.query(
    `
      INSERT INTO shared.audit_logs (
        id,
        user_id,
        action,
        entity_type,
        entity_id,
        actor_role,
        target,
        details,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())
    `,
    [
      crypto.randomUUID(),
      entry.userId ?? null,
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      entry.actorRole ?? null,
      entry.target ?? null,
      JSON.stringify(entry.details ?? {})
    ]
  );
}

export async function listAuditLogs(
  client: PoolClient,
  schema: string,
  filters: AuditLogFilter = {}
) {
  assertValidSchemaName(schema);

  const conditions: string[] = [];
  const params: unknown[] = [];
  let index = 1;

  if (filters.entityType) {
    conditions.push(`entity_type = $${index++}`);
    params.push(filters.entityType);
  }

  if (filters.userId) {
    conditions.push(`user_id = $${index++}`);
    params.push(filters.userId);
  }

  if (filters.from) {
    conditions.push(`created_at >= $${index++}`);
    params.push(filters.from);
  }

  if (filters.to) {
    conditions.push(`created_at <= $${index++}`);
    params.push(filters.to);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = filters.limit ? `LIMIT ${Math.max(1, filters.limit)}` : 'LIMIT 200';

  const result = await client.query(
    `
      SELECT id,
             user_id,
             action,
             entity_type,
             entity_id,
             details,
             created_at
      FROM ${schema}.audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      ${limitClause}
    `,
    params
  );

  return result.rows;
}

interface UnauthorizedAttemptPayload {
  userId?: string | null;
  path: string;
  method?: string;
  reason?: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
}

export async function logUnauthorizedAttempt(
  client: PoolClient | undefined,
  schema: string | undefined,
  payload: UnauthorizedAttemptPayload
): Promise<void> {
  if (!client || !schema) {
    return;
  }

  await recordAuditLog(client, schema, {
    userId: payload.userId ?? null,
    action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
    entityType: 'ACCESS',
    entityId: payload.entityId ?? null,
    details: {
      path: payload.path,
      method: payload.method ?? null,
      reason: payload.reason ?? null,
      ...(payload.details ?? {})
    }
  });
}
