import crypto from 'crypto';
import { getPool } from '../db/connection';
import {
  createSchemaSlug,
  createTenant,
  withTenantSearchPath,
  assertValidSchemaName
} from '../db/tenantManager';
import { recordSharedAuditLog, recordTenantAuditLog } from './auditLogService';
import { sendNotificationToAdmins } from './platformMonitoringService';
import { createUser } from './userService';

type SubscriptionType = 'free' | 'trial' | 'paid';
type TenantStatus = 'active' | 'suspended' | 'deleted';

export interface CreateSchoolInput {
  name: string;
  address: string;
  contactPhone: string;
  contactEmail: string;
  registrationCode: string;
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
  address?: string;
  contactPhone?: string;
  contactEmail?: string;
  registrationCode?: string;
}

export interface CreateAdminInput {
  email: string;
  password: string;
  username: string;
  fullName: string;
  phone?: string | null;
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

  // Only count superusers and admins (exclude students, teachers, HODs)
  const userCounts = await pool.query<{
    total_users: string;
    admins: string;
    superadmins: string;
    pending: string;
  }>(
    `
      SELECT
        COUNT(*)::text AS total_users,
        COUNT(*) FILTER (WHERE role = 'admin')::text AS admins,
        COUNT(*) FILTER (WHERE role = 'superadmin')::text AS superadmins,
        COUNT(*) FILTER (WHERE is_verified = FALSE)::text AS pending
      FROM shared.users
      WHERE role IN ('admin', 'superadmin')
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
      superadmins: Number(userCounts.rows[0]?.superadmins ?? 0),
      hods: 0,
      teachers: 0,
      students: 0
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
    school_id: string | null;
    address: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    registration_code: string | null;
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
        s.id AS school_id,
        s.address,
        s.contact_phone,
        s.contact_email,
        s.registration_code,
        u.user_count::text
      FROM shared.tenants t
      LEFT JOIN shared.schools s ON s.tenant_id = t.id
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
    schoolId: row.school_id,
    address: row.address,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    registrationCode: row.registration_code,
    userCount: Number(row.user_count ?? 0)
  }));
}

export async function createSchool(input: CreateSchoolInput, actorId?: string | null) {
  if (!input.name?.trim()) {
    throw new Error('School name is required');
  }
  if (!input.address?.trim()) {
    throw new Error('School address is required');
  }
  if (!input.contactPhone?.trim()) {
    throw new Error('School contact phone is required');
  }
  if (!input.contactEmail?.trim()) {
    throw new Error('School contact email is required');
  }
  if (!input.registrationCode?.trim()) {
    throw new Error('School registration code is required');
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

  const schoolId = crypto.randomUUID();
  await pool.query(
    `
      INSERT INTO shared.schools (
        id,
        tenant_id,
        name,
        address,
        contact_phone,
        contact_email,
        registration_code,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      ON CONFLICT (tenant_id) DO UPDATE
        SET name = EXCLUDED.name,
            address = EXCLUDED.address,
            contact_phone = EXCLUDED.contact_phone,
            contact_email = EXCLUDED.contact_email,
            registration_code = EXCLUDED.registration_code,
            updated_at = NOW()
    `,
    [
      schoolId,
      tenant.id,
      input.name.trim(),
      input.address.trim(),
      input.contactPhone.trim(),
      input.contactEmail.trim(),
      input.registrationCode.trim(),
      JSON.stringify({})
    ]
  );

  await recordSharedAuditLog({
    userId: actorId ?? undefined,
    action: 'SCHOOL_CREATED',
    entityType: 'TENANT',
    entityId: tenant.id,
    details: {
      name: input.name,
      schema: schemaName,
      subscriptionType: input.subscriptionType ?? 'trial',
      registrationCode: input.registrationCode
    }
  });

  await recordTenantAuditLog(schemaName, {
    userId: actorId ?? undefined,
    action: 'TENANT_INITIALISED',
    entityType: 'TENANT',
    entityId: tenant.id,
    details: {
      name: input.name,
      registrationCode: input.registrationCode
    }
  });

  return {
    id: tenant.id,
    schemaName,
    schoolId
  };
}

export async function updateSchool(
  id: string,
  updates: UpdateSchoolInput,
  actorId?: string | null
) {
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

  const hasSchoolFieldUpdates =
    updates.address !== undefined ||
    updates.contactPhone !== undefined ||
    updates.contactEmail !== undefined ||
    updates.registrationCode !== undefined;

  if (fields.length === 0 && !hasSchoolFieldUpdates) {
    const existing = await pool.query(
      `
        SELECT
          t.id,
          t.name,
          t.domain,
          t.status,
          t.subscription_type,
          t.billing_email,
          s.address,
          s.contact_phone,
          s.contact_email,
          s.registration_code
        FROM shared.tenants t
        LEFT JOIN shared.schools s ON s.tenant_id = t.id
        WHERE t.id = $1
      `,
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
  const updated = result.rows[0] ?? null;

  if (hasSchoolFieldUpdates) {
    await pool.query(
      `
        UPDATE shared.schools
        SET address = COALESCE($2, address),
            contact_phone = COALESCE($3, contact_phone),
            contact_email = COALESCE($4, contact_email),
            registration_code = COALESCE($5, registration_code),
            updated_at = NOW()
        WHERE tenant_id = $1
      `,
      [
        id,
        updates.address ?? null,
        updates.contactPhone ?? null,
        updates.contactEmail ?? null,
        updates.registrationCode ?? null
      ]
    );
  }

  if (!updated) {
    return null;
  }

  const schoolDetails = await pool.query(
    `
      SELECT address, contact_phone, contact_email, registration_code
      FROM shared.schools
      WHERE tenant_id = $1
    `,
    [id]
  );
  const schoolRow = schoolDetails.rows[0] ?? {};

  if (updated) {
    await recordSharedAuditLog({
      userId: actorId ?? undefined,
      action: 'SCHOOL_UPDATED',
      entityType: 'TENANT',
      entityId: id,
      details: { ...updates }
    });
  }

  return {
    ...updated,
    address: schoolRow.address ?? null,
    contactPhone: schoolRow.contact_phone ?? null,
    contactEmail: schoolRow.contact_email ?? null,
    registrationCode: schoolRow.registration_code ?? null
  };
}

export async function softDeleteSchool(id: string, actorId?: string | null) {
  const pool = getPool();
  await pool.query(
    `
      UPDATE shared.tenants
      SET status = 'deleted', updated_at = NOW()
      WHERE id = $1
    `,
    [id]
  );

  await recordSharedAuditLog({
    userId: actorId ?? undefined,
    action: 'SCHOOL_SOFT_DELETED',
    entityType: 'TENANT',
    entityId: id
  });
}

export async function createAdminForSchool(
  tenantId: string,
  input: CreateAdminInput,
  actorId?: string | null
) {
  if (!input.email || !input.password || !input.username || !input.fullName) {
    throw new Error('Email, password, username, and full name are required');
  }
  const pool = getPool();
  const normalizedEmail = input.email.toLowerCase();
  const normalizedUsername = input.username.toLowerCase();

  const duplicateCheck = await pool.query(`SELECT id FROM shared.users WHERE email = $1`, [
    normalizedEmail
  ]);
  if ((duplicateCheck.rowCount ?? 0) > 0) {
    throw new Error('Email already in use');
  }

  const duplicateUsername = await pool.query(`SELECT id FROM shared.users WHERE username = $1`, [
    normalizedUsername
  ]);
  if ((duplicateUsername.rowCount ?? 0) > 0) {
    throw new Error('Username already in use');
  }

  const schoolResult = await pool.query<{ id: string }>(
    `SELECT id FROM shared.schools WHERE tenant_id = $1`,
    [tenantId]
  );
  const schoolId = schoolResult.rows[0]?.id ?? null;
  if (!schoolId) {
    throw new Error('School profile not found for tenant');
  }

  // Use centralized user creation function
  const createdUser = await createUser(pool, {
    email: normalizedEmail,
    password: input.password,
    role: 'admin',
    tenantId,
    status: 'active',
    isVerified: true,
    username: normalizedUsername,
    fullName: input.fullName,
    phone: input.phone ?? null,
    schoolId,
    createdBy: actorId ?? null,
    auditLogEnabled: true,
    isTeachingStaff: false
  });

  const admin = {
    id: createdUser.id,
    email: createdUser.email,
    role: createdUser.role,
    tenant_id: createdUser.tenant_id,
    created_at: createdUser.created_at,
    username: createdUser.username,
    full_name: createdUser.full_name
  };

  await pool.query(
    `
      INSERT INTO shared.user_roles (user_id, role_name, assigned_by)
      VALUES ($1, 'admin', $2)
      ON CONFLICT (user_id, role_name) DO NOTHING
    `,
    [admin.id, actorId ?? null]
  );

  const tenantSchemaResult = await pool.query<{ schema_name: string }>(
    `SELECT schema_name FROM shared.tenants WHERE id = $1`,
    [tenantId]
  );
  const schemaName = tenantSchemaResult.rows[0]?.schema_name;

  await recordSharedAuditLog({
    userId: actorId ?? undefined,
    action: 'ADMIN_CREATED',
    entityType: 'USER',
    entityId: admin.id,
    details: {
      tenantId,
      email: admin.email
    }
  });

  if (schemaName) {
    await recordTenantAuditLog(schemaName, {
      userId: actorId ?? undefined,
      action: 'ADMIN_CREATED',
      entityType: 'USER',
      entityId: admin.id,
      details: {
        email: admin.email
      }
    });
  }

  await sendNotificationToAdmins({
    tenantId,
    title: 'Administrator account provisioned',
    message: `A new administrator account (${admin.email}) has been provisioned for your school.`,
    metadata: {
      tenantId,
      adminUserId: admin.id
    },
    actorId: actorId ?? undefined
  });

  return admin;
}

export async function getTenantAnalytics(tenantId: string) {
  const pool = getPool();
  const tenantResult = await pool.query<{ schema_name: string; name: string; created_at: Date }>(
    `SELECT schema_name, name, created_at FROM shared.tenants WHERE id = $1`,
    [tenantId]
  );

  if (tenantResult.rowCount === 0) {
    throw new Error('Tenant not found');
  }

  const tenant = tenantResult.rows[0];

  return await withTenantSearchPath(pool, tenant.schema_name, async (client) => {
    const [usersResult, teachersResult, studentsResult, classesResult] = await Promise.all([
      client.query(`SELECT COUNT(*)::int AS count FROM users`),
      client.query(`SELECT COUNT(*)::int AS count FROM teachers`),
      client.query(`SELECT COUNT(*)::int AS count FROM students`),
      client.query(`SELECT COUNT(*)::int AS count FROM classes`)
    ]);

    const [attendanceResult, examsResult] = await Promise.all([
      client.query(`
        SELECT COUNT(*)::int AS count 
        FROM attendance_records 
        WHERE attendance_date >= CURRENT_DATE - INTERVAL '30 days'
      `),
      client.query(`
        SELECT COUNT(*)::int AS count 
        FROM exams 
        WHERE exam_date >= CURRENT_DATE - INTERVAL '90 days'
      `)
    ]);

    return {
      tenantId,
      name: tenant.name,
      createdAt: tenant.created_at,
      userCount: usersResult.rows[0]?.count || 0,
      teacherCount: teachersResult.rows[0]?.count || 0,
      studentCount: studentsResult.rows[0]?.count || 0,
      classCount: classesResult.rows[0]?.count || 0,
      recentActivity: {
        attendanceRecords: attendanceResult.rows[0]?.count || 0,
        exams: examsResult.rows[0]?.count || 0
      }
    };
  });
}

// Function overloads for getUsageMonitoring
/* eslint-disable no-redeclare */
export async function getUsageMonitoring(tenantId: string): Promise<{
  tenantId: string;
  activeUsers: number;
  storageUsed: number;
  apiCalls: number;
  lastActivity: string;
}>;
export async function getUsageMonitoring(): Promise<{
  totalActiveUsers: number;
  totalStorage: number;
  totalApiCalls: number;
}>;
export async function getUsageMonitoring(tenantId?: string) {
  const pool = getPool();
  
  if (tenantId) {
    const tenantResult = await pool.query<{ schema_name: string }>(
      `SELECT schema_name FROM shared.tenants WHERE id = $1`,
      [tenantId]
    );
    
    if (tenantResult.rowCount === 0) {
      throw new Error('Tenant not found');
    }

    return await withTenantSearchPath(pool, tenantResult.rows[0].schema_name, async (client) => {
      const [activeUsersResult, storageResult] = await Promise.all([
        client.query(`
          SELECT COUNT(DISTINCT user_id)::int AS count
          FROM audit_logs
          WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        `),
        client.query(`
          SELECT COALESCE(SUM(pg_column_size(pdf)), 0)::bigint AS size
          FROM term_reports
        `)
      ]);

      return {
        tenantId,
        activeUsers: activeUsersResult.rows[0]?.count || 0,
        storageUsed: Math.round((storageResult.rows[0]?.size || 0) / 1024 / 1024 * 100) / 100, // MB
        apiCalls: 0, // Would need API logging middleware to track
        lastActivity: new Date().toISOString()
      };
    });
  }

  // Platform-wide usage
  const tenantsResult = await pool.query<{ id: string; schema_name: string }>(
    `SELECT id, schema_name FROM shared.tenants WHERE status = 'active'`
  );

  let totalActiveUsers = 0;
  let totalStorage = 0;

  for (const tenant of tenantsResult.rows) {
    const usage = await getUsageMonitoring(tenant.id);
    totalActiveUsers += usage.activeUsers;
    totalStorage += usage.storageUsed;
  }

  return {
    totalActiveUsers,
    totalStorage,
    totalApiCalls: 0 // Would need API logging middleware
  };
}
