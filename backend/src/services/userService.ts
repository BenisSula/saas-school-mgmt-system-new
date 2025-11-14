import { getPool } from '../db/connection';

type UserRole = 'student' | 'teacher' | 'admin' | 'superadmin';

export interface TenantUser {
  id: string;
  email: string;
  role: UserRole;
  is_verified: boolean;
  status: string | null;
  created_at: string;
  additional_roles?: Array<{ role: string; metadata?: Record<string, unknown> }>;
}

export async function listTenantUsers(
  tenantId: string,
  filters?: { status?: string; role?: string }
): Promise<TenantUser[]> {
  const pool = getPool();
  const conditions: string[] = ['u.tenant_id = $1'];
  const params: unknown[] = [tenantId];
  let paramIndex = 2;

  if (filters?.status) {
    conditions.push(`u.status = $${paramIndex}`);
    params.push(filters.status);
    paramIndex++;
  }

  if (filters?.role) {
    conditions.push(`u.role = $${paramIndex}`);
    params.push(filters.role);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `
      SELECT 
        u.id, 
        u.email, 
        u.role, 
        u.is_verified, 
        u.status, 
        u.created_at,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'role', ur.role_name,
              'metadata', ur.metadata
            )
          ) FILTER (WHERE ur.role_name IS NOT NULL),
          '[]'::json
        ) as additional_roles
      FROM shared.users u
      LEFT JOIN shared.user_roles ur ON u.id = ur.user_id
      ${whereClause}
      GROUP BY u.id, u.email, u.role, u.is_verified, u.status, u.created_at
      ORDER BY u.role, u.created_at DESC
    `,
    params
  );
  return result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    is_verified: row.is_verified,
    status: row.status,
    created_at: row.created_at,
    additional_roles: row.additional_roles || []
  }));
}

export async function updateTenantUserRole(
  tenantId: string,
  userId: string,
  role: UserRole,
  actorId: string
): Promise<TenantUser | null> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const updateResult = await client.query(
      `
        UPDATE shared.users
        SET role = $1
        WHERE id = $2
          AND tenant_id = $3
        RETURNING id, email, role, is_verified, status, created_at
      `,
      [role, userId, tenantId]
    );

    if (updateResult.rowCount === 0) {
      return null;
    }

    const user = updateResult.rows[0];

    const rolesResult = await client.query(
      `
        SELECT 
          role_name,
          metadata
        FROM shared.user_roles
        WHERE user_id = $1
      `,
      [userId]
    );

    console.info('[audit] user_role_updated', {
      tenantId,
      userId,
      newRole: role,
      actorId
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      is_verified: user.is_verified,
      status: user.status,
      created_at: user.created_at,
      additional_roles: rolesResult.rows.map((row) => ({
        role: row.role_name,
        metadata: row.metadata || {}
      }))
    };
  } finally {
    client.release();
  }
}

export async function updateUserStatus(
  tenantId: string,
  userId: string,
  status: 'pending' | 'active' | 'rejected' | 'suspended',
  actorId: string
): Promise<TenantUser | null> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const updateResult = await client.query(
      `
        UPDATE shared.users
        SET status = $1
        WHERE id = $2
          AND tenant_id = $3
        RETURNING id, email, role, is_verified, status, created_at
      `,
      [status, userId, tenantId]
    );

    if (updateResult.rowCount === 0) {
      return null;
    }

    const user = updateResult.rows[0];

    const rolesResult = await client.query(
      `
        SELECT 
          role_name,
          metadata
        FROM shared.user_roles
        WHERE user_id = $1
      `,
      [userId]
    );

    console.info('[audit] user_status_updated', {
      tenantId,
      userId,
      newStatus: status,
      actorId
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      is_verified: user.is_verified,
      status: user.status,
      created_at: user.created_at,
      additional_roles: rolesResult.rows.map((row) => ({
        role: row.role_name,
        metadata: row.metadata || {}
      }))
    };
  } finally {
    client.release();
  }
}
