import 'dotenv/config';
import argon2 from 'argon2';
import crypto from 'crypto';
import { getPool, closePool } from '../db/connection';
import { runMigrations } from '../db/runMigrations';
import { rolePermissions, Role } from '../config/permissions';
import { recordSharedAuditLog } from '../services/auditLogService';

const SUPERUSER_CREDENTIALS = {
  email: process.env.SEED_SUPERUSER_EMAIL ?? 'owner@saas-platform.system',
  password: process.env.SEED_SUPERUSER_PASSWORD ?? 'SuperOwner#2025!',
  name: process.env.SEED_SUPERUSER_NAME ?? 'Platform Owner',
  username: 'superuser'
};

async function syncRolePermissions(): Promise<void> {
  const pool = getPool();
  for (const [roleName, permissions] of Object.entries(rolePermissions)) {
    for (const permission of permissions) {
      await pool.query(
        `
          INSERT INTO shared.role_permissions (role_name, permission)
          VALUES ($1, $2)
          ON CONFLICT (role_name, permission) DO NOTHING
        `,
        [roleName, permission]
      );
    }
  }
}

async function upsertUserRole(
  userId: string,
  roleName: Role | 'hod',
  assignedBy: string | null,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `
      INSERT INTO shared.user_roles (user_id, role_name, assigned_by, metadata)
      VALUES ($1, $2, $3, $4::jsonb)
      ON CONFLICT (user_id, role_name) DO UPDATE
        SET assigned_at = NOW(),
            assigned_by = COALESCE(EXCLUDED.assigned_by, shared.user_roles.assigned_by),
            metadata = EXCLUDED.metadata
    `,
    [userId, roleName, assignedBy, JSON.stringify(metadata)]
  );
}

async function ensureSuperUser(): Promise<string> {
  const pool = getPool();
  const normalizedEmail = SUPERUSER_CREDENTIALS.email.toLowerCase();
  const passwordHash = await argon2.hash(SUPERUSER_CREDENTIALS.password);

  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM shared.users WHERE email = $1`,
    [normalizedEmail]
  );

  let superUserId: string;
  if ((existing.rowCount ?? 0) > 0) {
    superUserId = existing.rows[0].id;
    await pool.query(
      `
        UPDATE shared.users
        SET password_hash = $2,
            role = 'superadmin',
            tenant_id = NULL,
            school_id = NULL,
            department_id = NULL,
            username = $3,
            full_name = $4,
            is_verified = TRUE,
            is_teaching_staff = FALSE,
            status = 'active',
            audit_log_enabled = TRUE,
            created_by = NULL,
            updated_at = NOW()
        WHERE id = $1
      `,
      [superUserId, passwordHash, SUPERUSER_CREDENTIALS.username, SUPERUSER_CREDENTIALS.name]
    );
  } else {
    superUserId = crypto.randomUUID();
    await pool.query(
      `
        INSERT INTO shared.users (
          id,
          email,
          password_hash,
          role,
          tenant_id,
          is_verified,
          created_at,
          username,
          full_name,
          is_teaching_staff,
          status,
          audit_log_enabled,
          created_by
        )
        VALUES ($1, $2, $3, 'superadmin', NULL, TRUE, NOW(), $4, $5, FALSE, 'active', TRUE, NULL)
      `,
      [
        superUserId,
        normalizedEmail,
        passwordHash,
        SUPERUSER_CREDENTIALS.username,
        SUPERUSER_CREDENTIALS.name
      ]
    );
  }

  await upsertUserRole(superUserId, 'superadmin', superUserId, { source: 'superuser-only-seed' });

  await recordSharedAuditLog({
    userId: superUserId,
    action: 'SUPERUSER_PROVISIONED',
    entityType: 'USER',
    entityId: superUserId,
    details: {
      email: normalizedEmail,
      name: SUPERUSER_CREDENTIALS.name
    }
  });

  return superUserId;
}

async function main() {
  const pool = getPool();

  try {
    await runMigrations(pool);
    await syncRolePermissions();

    const superUserId = await ensureSuperUser();

    console.log('[seed] Superuser setup complete.');
    console.log('[seed] Superuser credentials:');
    console.log(`  Email: ${SUPERUSER_CREDENTIALS.email}`);
    console.log(`  Password: ${SUPERUSER_CREDENTIALS.password}`);
    console.log(`  Username: ${SUPERUSER_CREDENTIALS.username}`);
    console.log(`  Name: ${SUPERUSER_CREDENTIALS.name}`);
    console.log(`  User ID: ${superUserId}`);
  } catch (error) {
    console.error('[seed] Failed to complete SuperUser setup', error);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

main().catch((error) => {
  console.error('[seed] Unexpected failure', error);
  process.exit(1);
});

