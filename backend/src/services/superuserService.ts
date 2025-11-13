import argon2 from 'argon2';
import { getPool } from '../db/connection';
import {
  createSchemaSlug,
  createTenant,
  withTenantSearchPath,
  assertValidSchemaName
} from '../db/tenantManager';

type SubscriptionType = 'free' | 'trial' | 'paid';
type TenantStatus = 'active' | 'suspended' | 'deleted';

export interface CreateSchoolInput {
  name: string;
  domain?: string;
  subscriptionType?: SubscriptionType;
  billingEmail?: string | null;
}

export interface UpdateSchoolInput {
  name?: string;
  domain?: string | null;
  subscriptionType?: SubscriptionType;
  status?: TenantStatus;
  billingEmail?: string | null;
}

export interface CreateAdminInput {
  email: string;
  password: string;
  name?: string | null;
}

export async function getPlatformOverview() {
  const pool = getPool();

  const tenantsResult = await pool.query<{
    id: string;
    name: string;
    schema_name: string;
    status: TenantStatus;
    subscription_type: SubscriptionType;
    created_at: Date;
  }>(`SELECT id, name, schema_name, status, subscription_type, created_at FROM shared.tenants`);

  const totalSchools = tenantsResult.rowCount;
  const activeSchools = tenantsResult.rows.filter((tenant) => tenant.status === 'active').length;
  const suspendedSchools = tenantsResult.rows.filter(
    (tenant) => tenant.status === 'suspended'
  ).length;

  const subscriptionBreakdown = tenantsResult.rows.reduce<Record<SubscriptionType, number>>(
    (acc, tenant) => {
      acc[tenant.subscription_type] = (acc[tenant.subscription_type] ?? 0) + 1;
      return acc;
    },
    { free: 0, trial: 0, paid: 0 }
  );

  const userCounts = await pool.query<{
    total_users: string;
    admins: string;
    teachers: string;
    students: string;
    pending: string;
  }>(
    `
      SELECT
        COUNT(*)::text AS total_users,
        COUNT(*) FILTER (WHERE role = 'admin')::text AS admins,
        COUNT(*) FILTER (WHERE role = 'teacher')::text AS teachers,
        COUNT(*) FILTER (WHERE role = 'student')::text AS students,
        COUNT(*) FILTER (WHERE is_verified = FALSE)::text AS pending
      FROM shared.users
    `
  );

  let totalRevenue = 0;
  const revenueByTenant: Array<{ tenantId: string; amount: number }> = [];

  for (const tenant of tenantsResult.rows) {
    if (tenant.status === 'deleted') {
      continue;
    }
    const revenueResult = await withTenantSearchPath(pool, tenant.schema_name, async (client) => {
      const res = await client.query<{ amount: string | null }>(
        `SELECT COALESCE(SUM(amount), 0) AS amount FROM payments WHERE status = 'succeeded'`
      );
      return res.rows[0]?.amount ? Number(res.rows[0].amount) : 0;
    });

    totalRevenue += revenueResult;
    revenueByTenant.push({ tenantId: tenant.id, amount: revenueResult });
  }

  const recentSchools = tenantsResult.rows
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    .slice(0, 5)
    .map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
      subscriptionType: tenant.subscription_type,
      createdAt: tenant.created_at
    }));

  return {
    totals: {
      schools: totalSchools,
      activeSchools,
      suspendedSchools,
      users: Number(userCounts.rows[0]?.total_users ?? 0),
      pendingUsers: Number(userCounts.rows[0]?.pending ?? 0)
    },
    roleDistribution: {
      admins: Number(userCounts.rows[0]?.admins ?? 0),
      teachers: Number(userCounts.rows[0]?.teachers ?? 0),
      students: Number(userCounts.rows[0]?.students ?? 0)
    },
    subscriptionBreakdown,
    revenue: {
      total: totalRevenue,
      byTenant: revenueByTenant
    },
    recentSchools
  };
}

export async function listSchools() {
  const pool = getPool();
  const result = await pool.query<{
    id: string;
    name: string;
    domain: string | null;
    schema_name: string;
    status: TenantStatus;
    subscription_type: SubscriptionType;
    billing_email: string | null;
    created_at: Date;
    user_count: string | null;
  }>(
    `
      SELECT
        t.id,
        t.name,
        t.domain,
        t.schema_name,
        t.status,
        t.subscription_type,
        t.billing_email,
        t.created_at,
        u.user_count::text
      FROM shared.tenants t
      LEFT JOIN (
        SELECT tenant_id, COUNT(*) AS user_count
        FROM shared.users
        GROUP BY tenant_id
      ) u ON u.tenant_id = t.id
      ORDER BY t.created_at DESC
    `
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    domain: row.domain,
    schemaName: row.schema_name,
    status: row.status,
    subscriptionType: row.subscription_type,
    billingEmail: row.billing_email,
    createdAt: row.created_at,
    userCount: Number(row.user_count ?? 0)
  }));
}

export async function createSchool(input: CreateSchoolInput) {
  if (!input.name?.trim()) {
    throw new Error('School name is required');
  }
  const pool = getPool();
  const schemaName = createSchemaSlug(input.name);
  assertValidSchemaName(schemaName);

  const tenant = await createTenant(
    {
      name: input.name,
      domain: input.domain,
      schemaName,
      subscriptionType: input.subscriptionType ?? 'trial',
      billingEmail: input.billingEmail ?? null
    },
    pool
  );

  return {
    id: tenant.id,
    schemaName
  };
}

export async function updateSchool(id: string, updates: UpdateSchoolInput) {
  const pool = getPool();
  const fields = [];
  const values: Array<string | SubscriptionType | TenantStatus | null> = [];

  if (typeof updates.name === 'string') {
    fields.push(`name = $${fields.length + 2}`);
    values.push(updates.name.trim());
  }
  if (updates.domain !== undefined) {
    fields.push(`domain = $${fields.length + 2}`);
    values.push(updates.domain ? updates.domain.trim() : null);
  }
  if (updates.subscriptionType) {
    fields.push(`subscription_type = $${fields.length + 2}`);
    values.push(updates.subscriptionType);
  }
  if (updates.status) {
    fields.push(`status = $${fields.length + 2}`);
    values.push(updates.status);
  }
  if (updates.billingEmail !== undefined) {
    fields.push(`billing_email = $${fields.length + 2}`);
    values.push(updates.billingEmail ? updates.billingEmail.trim().toLowerCase() : null);
  }

  if (fields.length === 0) {
    const existing = await pool.query(
      `SELECT id, name, domain, status, subscription_type, billing_email FROM shared.tenants WHERE id = $1`,
      [id]
    );
    return existing.rows[0] ?? null;
  }

  const query = `
    UPDATE shared.tenants
    SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $1
    RETURNING id, name, domain, status, subscription_type, billing_email
  `;
  const result = await pool.query(query, [id, ...values]);
  return result.rows[0] ?? null;
}

export async function softDeleteSchool(id: string) {
  const pool = getPool();
  await pool.query(
    `
      UPDATE shared.tenants
      SET status = 'deleted', updated_at = NOW()
      WHERE id = $1
    `,
    [id]
  );
}

export async function createAdminForSchool(tenantId: string, input: CreateAdminInput) {
  if (!input.email || !input.password) {
    throw new Error('Email and password are required');
  }
  const pool = getPool();
  const normalizedEmail = input.email.toLowerCase();

  const duplicateCheck = await pool.query(`SELECT id FROM shared.users WHERE email = $1`, [
    normalizedEmail
  ]);
  if ((duplicateCheck.rowCount ?? 0) > 0) {
    throw new Error('Email already in use');
  }

  const passwordHash = await argon2.hash(input.password);
  const result = await pool.query(
    `
      INSERT INTO shared.users (email, password_hash, role, tenant_id, is_verified)
      VALUES ($1, $2, 'admin', $3, TRUE)
      RETURNING id, email, role, tenant_id, created_at
    `,
    [normalizedEmail, passwordHash, tenantId]
  );

  return result.rows[0];
}
