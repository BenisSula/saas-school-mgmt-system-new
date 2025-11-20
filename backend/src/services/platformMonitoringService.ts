import crypto from 'crypto';
import { getPool } from '../db/connection';
import { recordSharedAuditLog } from './auditLogService';
import { hashTokenValue } from './tokenService';

export interface SessionContext {
  ip?: string | null;
  userAgent?: string | null;
}

export interface PlatformUserSummary {
  id: string;
  email: string;
  username: string | null;
  fullName: string | null;
  role: string;
  tenantId: string | null;
  tenantName: string | null;
  schoolId: string | null;
  schoolName: string | null;
  registrationCode: string | null;
  isVerified: boolean;
  status: string | null;
  auditLogEnabled: boolean;
  isTeachingStaff: boolean;
  createdAt: string;
  gender: string | null;
  dateOfBirth: string | null;
  enrollmentDate: string | null;
  metadata: Record<string, unknown> | null;
}

export interface AdminNotificationInput {
  tenantId?: string | null;
  title: string;
  message: string;
  targetRole?: string;
  targetRoles?: string[];
  metadata?: Record<string, unknown>;
  actorId?: string | null;
}

function normaliseContext(context?: SessionContext) {
  return {
    ip: context?.ip ?? null,
    userAgent: context?.userAgent ?? null
  };
}

export async function recordLoginEvent(
  userId: string,
  refreshToken: string,
  context?: SessionContext
): Promise<void> {
  if (!refreshToken) {
    return;
  }

  try {
    const pool = getPool();
    const refreshTokenHash = hashTokenValue(refreshToken);
    const sessionId = crypto.randomUUID();
    const { ip, userAgent } = normaliseContext(context);

    // Try to insert directly - if table doesn't exist, the error will be caught
    // This approach works better with pg-mem which doesn't fully support information_schema
    try {
      await pool.query(
        `
          INSERT INTO shared.user_sessions (
            id,
            user_id,
            refresh_token_hash,
            login_at,
            login_ip,
            login_user_agent,
            logout_at,
            logout_ip,
            logout_user_agent
          )
          VALUES ($1, $2, $3, NOW(), $4, $5, NULL, NULL, NULL)
          ON CONFLICT (refresh_token_hash) DO UPDATE
            SET user_id = EXCLUDED.user_id,
                login_at = NOW(),
                login_ip = EXCLUDED.login_ip,
                login_user_agent = EXCLUDED.login_user_agent,
                logout_at = NULL,
                logout_ip = NULL,
                logout_user_agent = NULL
        `,
        [sessionId, userId, refreshTokenHash, ip, userAgent]
      );
    } catch (insertError) {
      // If table doesn't exist, that's okay - session tracking is non-critical
      // Check if it's a "relation does not exist" error
      const errorMessage = insertError instanceof Error ? insertError.message : String(insertError);
      if (!errorMessage.includes('does not exist') && !errorMessage.includes('relation')) {
        // Re-throw if it's a different error (e.g., constraint violation)
        throw insertError;
      }
      // Otherwise, silently ignore - table doesn't exist yet
    }

    // Record audit log - don't fail if this fails
    try {
      await recordSharedAuditLog({
        userId,
        action: 'LOGIN',
        entityType: 'USER_SESSION',
        entityId: sessionId,
        details: {
          ip,
          userAgent
        }
      });
    } catch (auditError) {
      console.error('[platformMonitoring] Failed to record audit log:', auditError);
      // Don't throw - audit logging is non-critical
    }
  } catch (error) {
    // Log error but don't throw - login event recording is non-critical
    console.error('[platformMonitoring] Failed to record login event:', error);
    // Don't rethrow - we don't want to fail login if session tracking fails
  }
}

export async function recordLogoutEvent(
  userId: string,
  refreshToken: string,
  context?: SessionContext
): Promise<void> {
  if (!refreshToken) {
    return;
  }
  const pool = getPool();
  const refreshTokenHash = hashTokenValue(refreshToken);
  const { ip, userAgent } = normaliseContext(context);

  const result = await pool.query(
    `
      UPDATE shared.user_sessions
      SET logout_at = NOW(),
          logout_ip = $1,
          logout_user_agent = $2
      WHERE user_id = $3
        AND refresh_token_hash = $4
      RETURNING id
    `,
    [ip, userAgent, userId, refreshTokenHash]
  );

  const sessionId = result.rows[0]?.id ?? null;

  await recordSharedAuditLog({
    userId,
    action: 'LOGOUT',
    entityType: 'USER_SESSION',
    entityId: sessionId ?? undefined,
    details: {
      ip,
      userAgent
    }
  });
}

export async function rotateSessionToken(
  userId: string,
  previousToken: string,
  newToken: string,
  context?: SessionContext
): Promise<void> {
  if (!previousToken || !newToken) {
    return;
  }
  const pool = getPool();
  const previousHash = hashTokenValue(previousToken);
  const nextHash = hashTokenValue(newToken);
  const { ip, userAgent } = normaliseContext(context);

  const result = await pool.query(
    `
      UPDATE shared.user_sessions
      SET refresh_token_hash = $1,
          login_at = COALESCE(login_at, NOW()),
          login_ip = COALESCE(login_ip, $2),
          login_user_agent = COALESCE(login_user_agent, $3),
          logout_at = NULL,
          logout_ip = NULL,
          logout_user_agent = NULL
      WHERE user_id = $4
        AND refresh_token_hash = $5
      RETURNING id
    `,
    [nextHash, ip, userAgent, userId, previousHash]
  );

  const sessionId = result.rows[0]?.id;

  if (!sessionId) {
    await recordLoginEvent(userId, newToken, context);
    return;
  }

  await recordSharedAuditLog({
    userId,
    action: 'SESSION_ROTATED',
    entityType: 'USER_SESSION',
    entityId: sessionId,
    details: {
      ip,
      userAgent
    }
  });
}

export async function listAllPlatformUsers(): Promise<PlatformUserSummary[]> {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT
        u.id,
        u.email,
        u.username,
        u.full_name,
        u.role,
        u.tenant_id,
        u.is_verified,
        u.status,
        u.audit_log_enabled,
        u.is_teaching_staff,
        u.created_at,
        u.gender,
        u.date_of_birth,
        u.enrollment_date,
        u.metadata,
        t.name AS tenant_name,
        s.id AS school_id,
        s.name AS school_name,
        s.registration_code
      FROM shared.users u
      LEFT JOIN shared.tenants t ON t.id = u.tenant_id
      LEFT JOIN shared.schools s ON s.id = u.school_id
      ORDER BY u.created_at DESC
    `
  );

  return result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    username: row.username ?? null,
    fullName: row.full_name ?? null,
    role: row.role,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name ?? null,
    schoolId: row.school_id ?? null,
    schoolName: row.school_name ?? null,
    registrationCode: row.registration_code ?? null,
    isVerified: row.is_verified,
    status: row.status ?? null,
    auditLogEnabled: Boolean(row.audit_log_enabled),
    isTeachingStaff: Boolean(row.is_teaching_staff),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    gender: row.gender ?? null,
    dateOfBirth:
      row.date_of_birth instanceof Date ? row.date_of_birth.toISOString().split('T')[0] : null,
    enrollmentDate:
      row.enrollment_date instanceof Date ? row.enrollment_date.toISOString().split('T')[0] : null,
    metadata: row.metadata ?? null
  }));
}

export async function sendNotificationToAdmins({
  tenantId,
  title,
  message,
  targetRole = 'admin',
  targetRoles,
  metadata,
  actorId
}: AdminNotificationInput): Promise<{ sentCount: number; notificationIds: string[] }> {
  if (!title?.trim() || !message?.trim()) {
    throw new Error('Notification title and message are required');
  }

  const pool = getPool();
  const effectiveRoles = Array.from(
    new Set(
      (targetRoles && targetRoles.length > 0 ? targetRoles : [targetRole])
        .map((roleValue) => roleValue?.trim())
        .filter((roleValue): roleValue is string => Boolean(roleValue))
    )
  );

  if (effectiveRoles.length === 0) {
    throw new Error('At least one target role is required for notifications');
  }

  const rolePlaceholders = effectiveRoles.map((_, index) => `$${index + 1}`).join(', ');
  const params: Array<string | null> = [...effectiveRoles];
  const tenantParamIndex = params.push(tenantId ?? null);

  const recipientsResult = await pool.query(
    `
      SELECT id, tenant_id
      FROM shared.users
      WHERE role IN (${rolePlaceholders})
        AND ($${tenantParamIndex}::uuid IS NULL OR tenant_id = $${tenantParamIndex}::uuid)
      ORDER BY created_at DESC
    `,
    params
  );

  if (recipientsResult.rowCount === 0) {
    return { sentCount: 0, notificationIds: [] };
  }

  const notificationIds: string[] = [];
  for (const recipient of recipientsResult.rows) {
    const notificationId = crypto.randomUUID();
    notificationIds.push(notificationId);
    await pool.query(
      `
        INSERT INTO shared.notifications (
          id,
          tenant_id,
          recipient_user_id,
          target_role,
          target_roles,
          title,
          message,
          status,
          metadata,
          sent_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'sent', $8::jsonb, NOW())
      `,
      [
        notificationId,
        recipient.tenant_id,
        recipient.id,
        effectiveRoles.length === 1 ? effectiveRoles[0] : null,
        effectiveRoles,
        title.trim(),
        message.trim(),
        JSON.stringify(metadata ?? {})
      ]
    );
  }

  await recordSharedAuditLog({
    userId: actorId ?? undefined,
    action: 'ADMIN_NOTIFICATION_SENT',
    entityType: 'NOTIFICATION',
    entityId: notificationIds[0],
    details: {
      tenantId: tenantId ?? 'all',
      title,
      message,
      targetRoles: effectiveRoles,
      recipients: recipientsResult.rowCount
    }
  });

  return { sentCount: recipientsResult.rowCount ?? 0, notificationIds };
}

export async function updatePlatformUserStatus(
  userId: string,
  status: 'pending' | 'active' | 'suspended' | 'rejected',
  actorId: string | null
): Promise<PlatformUserSummary | null> {
  const pool = getPool();
  const result = await pool.query(
    `
      UPDATE shared.users
      SET status = $1
      WHERE id = $2
      RETURNING id, email, username, full_name, role, tenant_id, is_verified, status,
                audit_log_enabled, is_teaching_staff, created_at, gender, date_of_birth,
                enrollment_date, metadata
    `,
    [status, userId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];

  // Get tenant and school info
  const tenantResult = await pool.query(
    `
      SELECT t.name AS tenant_name, s.id AS school_id, s.name AS school_name, s.registration_code
      FROM shared.users u
      LEFT JOIN shared.tenants t ON t.id = u.tenant_id
      LEFT JOIN shared.schools s ON s.id = u.school_id
      WHERE u.id = $1
    `,
    [userId]
  );

  const tenantInfo = tenantResult.rows[0] || {};

  await recordSharedAuditLog({
    userId: actorId ?? undefined,
    action: 'USER_STATUS_UPDATED',
    entityType: 'USER',
    entityId: userId,
    details: {
      newStatus: status,
      userEmail: row.email
    }
  });

  return {
    id: row.id,
    email: row.email,
    username: row.username ?? null,
    fullName: row.full_name ?? null,
    role: row.role,
    tenantId: row.tenant_id,
    tenantName: tenantInfo.tenant_name ?? null,
    schoolId: tenantInfo.school_id ?? null,
    schoolName: tenantInfo.school_name ?? null,
    registrationCode: tenantInfo.registration_code ?? null,
    isVerified: row.is_verified,
    status: row.status ?? null,
    auditLogEnabled: Boolean(row.audit_log_enabled),
    isTeachingStaff: Boolean(row.is_teaching_staff),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    gender: row.gender ?? null,
    dateOfBirth:
      row.date_of_birth instanceof Date ? row.date_of_birth.toISOString().split('T')[0] : null,
    enrollmentDate:
      row.enrollment_date instanceof Date ? row.enrollment_date.toISOString().split('T')[0] : null,
    metadata: row.metadata ?? null
  };
}

export async function generatePlatformReport(
  type: 'audit' | 'users' | 'revenue' | 'activity',
  actorId: string | null
): Promise<{ id: string; downloadUrl?: string }> {
  const reportId = crypto.randomUUID();

  // For now, return report ID. In production, this would generate actual reports
  // and store them in S3 or similar, returning a download URL
  await recordSharedAuditLog({
    userId: actorId ?? undefined,
    action: 'PLATFORM_REPORT_GENERATED',
    entityType: 'REPORT' as const,
    entityId: reportId,
    details: {
      reportType: type
    }
  });

  return {
    id: reportId
    // downloadUrl would be added when actual report generation is implemented
  };
}

export async function updatePlatformSettings(
  settings: {
    globalBranding: {
      platformName: string;
      defaultLogoUrl: string | null;
      defaultPrimaryColor: string;
    };
    authentication: {
      requireEmailVerification: boolean;
      allowSelfRegistration: boolean;
      sessionTimeoutMinutes: number;
    };
    features: {
      enableAuditLogging: boolean;
      enableNotifications: boolean;
      enableHighContrastMode: boolean;
    };
    integrations: {
      paymentProcessor: string;
      emailProvider: string;
      smsProvider: string | null;
    };
  },
  actorId: string | null
): Promise<void> {
  // Store settings in a platform_settings table (would need migration)
  // For now, we'll just audit log the change
  await recordSharedAuditLog({
    userId: actorId ?? undefined,
    action: 'PLATFORM_SETTINGS_UPDATED',
    entityType: 'SETTINGS' as const,
    entityId: 'platform',
    details: {
      settings
    }
  });

  // In production, you'd update a platform_settings table here
  // await pool.query(`
  //   INSERT INTO shared.platform_settings (id, settings, updated_at, updated_by)
  //   VALUES ('platform', $1::jsonb, NOW(), $2)
  //   ON CONFLICT (id) DO UPDATE
  //     SET settings = EXCLUDED.settings,
  //         updated_at = NOW(),
  //         updated_by = EXCLUDED.updated_by
  // `, [JSON.stringify(settings), actorId]);
}
