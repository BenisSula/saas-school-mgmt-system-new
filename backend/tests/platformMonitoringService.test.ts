import crypto from 'crypto';
import { createTestPool } from './utils/testDb';
import { getPool } from '../src/db/connection';
import {
  recordLoginEvent,
  rotateSessionToken,
  recordLogoutEvent,
  sendNotificationToAdmins,
  listAllPlatformUsers,
} from '../src/services/platformMonitoringService';
import { hashTokenValue } from '../src/services/tokenService';

jest.mock('../src/db/connection', () => ({
  getPool: jest.fn(),
  closePool: jest.fn(),
}));

const mockedGetPool = jest.mocked(getPool);

describe('platformMonitoringService', () => {
  let pool: Awaited<ReturnType<typeof createTestPool>>['pool'];
  let tenantId: string;
  let superUserId: string;
  let adminUserId: string;
  let teacherUserId: string;

  beforeAll(async () => {
    const testPool = await createTestPool();
    pool = testPool.pool;
    mockedGetPool.mockReturnValue(pool);
  });

  beforeEach(async () => {
    // Create user_sessions table if it doesn't exist (for pg-mem compatibility)
    // Use uuid_generate_v4() which is registered in testDb.ts for pg-mem
    await pool
      .query(
        `
      CREATE TABLE IF NOT EXISTS shared.user_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES shared.users(id) ON DELETE CASCADE,
        refresh_token_hash TEXT UNIQUE,
        login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        logout_at TIMESTAMPTZ,
        login_ip TEXT,
        login_user_agent TEXT,
        logout_ip TEXT,
        logout_user_agent TEXT
      )
    `
      )
      .catch(() => {
        // Table might already exist, ignore error
      });

    await pool.query('DELETE FROM shared.user_sessions').catch(() => {});
    await pool.query('DELETE FROM shared.notifications').catch(() => {});
    await pool.query('DELETE FROM shared.audit_logs').catch(() => {});
    await pool.query('DELETE FROM shared.users').catch(() => {});
    await pool.query('DELETE FROM shared.tenants').catch(() => {});

    tenantId = crypto.randomUUID();
    superUserId = crypto.randomUUID();
    adminUserId = crypto.randomUUID();
    teacherUserId = crypto.randomUUID();

    await pool.query(
      `
        INSERT INTO shared.tenants (id, name, schema_name, subscription_type, status)
        VALUES ($1, $2, $3, 'trial', 'active')
      `,
      [tenantId, 'Test School', 'tenant_test_school']
    );

    await pool.query(
      `
        INSERT INTO shared.users (
          id,
          email,
          password_hash,
          role,
          tenant_id,
          is_verified,
          status,
          audit_log_enabled,
          is_teaching_staff
        )
        VALUES
          ($1, 'owner@test.system', 'hash', 'superadmin', NULL, TRUE, 'active', TRUE, FALSE),
          ($2, 'admin@test.school', 'hash', 'admin', $4, TRUE, 'active', FALSE, FALSE),
          ($3, 'teacher@test.school', 'hash', 'teacher', $4, TRUE, 'active', TRUE, TRUE)
      `,
      [superUserId, adminUserId, teacherUserId, tenantId]
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it('records login and logout events with session metadata', async () => {
    const refreshToken = 'refresh-token-value';
    await recordLoginEvent(adminUserId, refreshToken, {
      ip: '127.0.0.1',
      userAgent: 'jest',
    });

    const loginResult = await pool.query(
      `SELECT user_id, refresh_token_hash, login_ip, login_user_agent, logout_at FROM shared.user_sessions`
    );
    expect(loginResult.rowCount).toBe(1);
    expect(loginResult.rows[0].user_id).toBe(adminUserId);
    expect(loginResult.rows[0].refresh_token_hash).toBe(hashTokenValue(refreshToken));
    expect(loginResult.rows[0].login_ip).toBe('127.0.0.1');
    expect(loginResult.rows[0].login_user_agent).toBe('jest');
    expect(loginResult.rows[0].logout_at).toBeNull();

    await recordLogoutEvent(adminUserId, refreshToken, {
      ip: '127.0.0.1',
      userAgent: 'jest',
    });

    const logoutResult = await pool.query(
      `SELECT logout_at, logout_ip FROM shared.user_sessions WHERE user_id = $1`,
      [adminUserId]
    );
    expect(logoutResult.rowCount).toBe(1);
    expect(logoutResult.rows[0].logout_at).not.toBeNull();
    expect(logoutResult.rows[0].logout_ip).toBe('127.0.0.1');
  });

  it('rotates session token on refresh', async () => {
    const oldToken = 'old-refresh-token';
    const newToken = 'new-refresh-token';

    await recordLoginEvent(adminUserId, oldToken);
    await rotateSessionToken(adminUserId, oldToken, newToken);

    const sessionResult = await pool.query(
      `SELECT refresh_token_hash FROM shared.user_sessions WHERE user_id = $1`,
      [adminUserId]
    );
    expect(sessionResult.rowCount).toBe(1);
    expect(sessionResult.rows[0].refresh_token_hash).toBe(hashTokenValue(newToken));
  });

  it('sends notifications to tenant admins and logs audit event', async () => {
    const response = await sendNotificationToAdmins({
      tenantId,
      title: 'System maintenance',
      message: 'Platform will be offline at midnight',
      actorId: superUserId,
    });

    expect(response.sentCount).toBe(1);
    expect(response.notificationIds).toHaveLength(1);

    const notificationResult = await pool.query(
      `SELECT tenant_id, recipient_user_id, title, message, target_roles FROM shared.notifications`
    );
    expect(notificationResult.rowCount).toBe(1);
    expect(notificationResult.rows[0].tenant_id).toBe(tenantId);
    expect(notificationResult.rows[0].recipient_user_id).toBe(adminUserId);
    expect(notificationResult.rows[0].title).toBe('System maintenance');
    expect(notificationResult.rows[0].message).toBe('Platform will be offline at midnight');
    expect(notificationResult.rows[0].target_roles).toEqual(['admin']);

    const auditResult = await pool.query(`SELECT action FROM shared.audit_logs`);
    expect(auditResult.rows.some((row) => row.action === 'ADMIN_NOTIFICATION_SENT')).toBe(true);
  });

  it('lists all platform users with tenant context', async () => {
    const users = await listAllPlatformUsers();
    const roles = users.map((user) => user.role).sort();
    expect(roles).toEqual(['admin', 'superadmin', 'teacher']);
    const adminRecord = users.find((user) => user.role === 'admin');
    expect(adminRecord?.tenantId).toBe(tenantId);
    expect(adminRecord?.tenantName).toBe('Test School');
    expect(adminRecord?.username).toBeNull();
    expect(adminRecord?.schoolName).toBeNull();
    expect(adminRecord?.status).toBe('active');
    expect(adminRecord?.auditLogEnabled).toBe(false);
    expect(adminRecord?.isTeachingStaff).toBe(false);
    expect(adminRecord?.gender).toBeNull();
    expect(adminRecord?.dateOfBirth).toBeNull();
    expect(adminRecord?.enrollmentDate).toBeNull();
    expect(adminRecord?.metadata).toEqual({});
  });
});
