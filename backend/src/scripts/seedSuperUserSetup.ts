import 'dotenv/config';
import argon2 from 'argon2';
import crypto from 'crypto';
import { getPool, closePool } from '../db/connection';
import { runMigrations } from '../db/runMigrations';
import {
  createSchemaSlug,
  createTenant,
  runTenantMigrations,
  seedTenant
} from '../db/tenantManager';
import { rolePermissions, Role } from '../config/permissions';
import { recordSharedAuditLog } from '../services/auditLogService';

type AdminSeed = {
  fullName: string;
  email: string;
  username: string;
  password: string;
  phone?: string | null;
};

type HodSeed = {
  fullName: string;
  email: string;
  phone: string;
  roleKey: string;
  username: string;
  password: string;
  permissions: string[];
};

type DepartmentSeed = {
  name: string;
  hod: HodSeed;
};

type SchoolSeed = {
  name: string;
  address: string;
  contactPhone: string;
  contactEmail: string;
  registrationCode: string;
  admin: AdminSeed;
  departments: DepartmentSeed[];
};

type BroadcastNotificationSeed = {
  registrationCode: string;
  title: string;
  message: string;
  targetRoles: string[];
  status: string;
};

const SUPERUSER_CREDENTIALS = {
  email: process.env.SEED_SUPERUSER_EMAIL ?? 'owner@saas-platform.system',
  password: process.env.SEED_SUPERUSER_PASSWORD ?? 'SuperOwner#2025!',
  name: process.env.SEED_SUPERUSER_NAME ?? 'Platform Owner',
  username: 'superuser'
};

export const schoolAdmins = [
  {
    school: 'New Horizon Senior Secondary School',
    email: 'fatou.jallow@newhorizon.edu.gm',
    username: 'nhs_admin'
  },
  {
    school: 'St. Peter’s Senior Secondary School',
    email: 'lamin.sowe@stpeterslamin.edu.gm',
    username: 'stp_admin'
  },
  {
    school: 'Daddy Jobe Comprehensive Senior Secondary School',
    email: 'musu.bah@daddyjobe.edu.gm',
    username: 'djc_admin'
  }
];

const SCHOOL_SEEDS: SchoolSeed[] = [
  {
    name: 'New Horizon Senior Secondary School',
    address: 'Hagan Street, Banjul',
    contactPhone: '+220 422 7891',
    contactEmail: 'info@newhorizon.edu.gm',
    registrationCode: 'NHS-BJL-2025',
    admin: {
      fullName: 'Fatou Jallow',
      email: 'fatou.jallow@newhorizon.edu.gm',
      username: 'nhs_admin',
      password: 'NhsAdmin@2025'
    },
    departments: [
      {
        name: 'Science',
        hod: {
          fullName: 'Alhaji Saine',
          email: 'alhaji.saine@newhorizon.edu.gm',
          phone: '+220 312 8890',
          roleKey: 'hod_science',
          username: 'nhs_hod_science',
          password: 'NhsScienceHOD@2025',
          permissions: ['department-analytics', 'reports:view']
        }
      },
      {
        name: 'Commerce',
        hod: {
          fullName: 'Mariama Camara',
          email: 'mariama.camara@newhorizon.edu.gm',
          phone: '+220 761 2298',
          roleKey: 'hod_commerce',
          username: 'nhs_hod_commerce',
          password: 'NhsCommerceHOD@2025',
          permissions: ['department-analytics', 'reports:view']
        }
      },
      {
        name: 'Arts',
        hod: {
          fullName: 'Joseph Ceesay',
          email: 'joseph.ceesay@newhorizon.edu.gm',
          phone: '+220 591 3482',
          roleKey: 'hod_arts',
          username: 'nhs_hod_arts',
          password: 'NhsArtsHOD@2025',
          permissions: ['department-analytics', 'reports:view']
        }
      }
    ]
  },
  {
    name: 'St. Peter’s Senior Secondary School',
    address: 'Lamin Village, West Coast Region',
    contactPhone: '+220 377 2140',
    contactEmail: 'admin@stpeterslamin.edu.gm',
    registrationCode: 'STP-LMN-2025',
    admin: {
      fullName: 'Lamin Sowe',
      email: 'lamin.sowe@stpeterslamin.edu.gm',
      username: 'stp_admin',
      password: 'StpAdmin@2025'
    },
    departments: [
      {
        name: 'Science',
        hod: {
          fullName: 'Hassan Njie',
          email: 'hassan.njie@stpeterslamin.edu.gm',
          phone: '+220 392 1874',
          roleKey: 'hod_science',
          username: 'stp_hod_science',
          password: 'StpScienceHOD@2025',
          permissions: ['department-analytics', 'attendance:view', 'performance:charts']
        }
      },
      {
        name: 'Commerce',
        hod: {
          fullName: 'Abdoulie Touray',
          email: 'abdoulie.touray@stpeterslamin.edu.gm',
          phone: '+220 344 9802',
          roleKey: 'hod_commerce',
          username: 'stp_hod_commerce',
          password: 'StpCommerceHOD@2025',
          permissions: ['department-analytics', 'attendance:view', 'performance:charts']
        }
      },
      {
        name: 'Arts',
        hod: {
          fullName: 'Ebrima Sanyang',
          email: 'ebrima.sanyang@stpeterslamin.edu.gm',
          phone: '+220 763 2555',
          roleKey: 'hod_arts',
          username: 'stp_hod_arts',
          password: 'StpArtsHOD@2025',
          permissions: ['department-analytics', 'attendance:view', 'performance:charts']
        }
      }
    ]
  },
  {
    name: 'Daddy Jobe Comprehensive Senior Secondary School',
    address: 'Coastal Road, Serrekunda',
    contactPhone: '+220 744 5172',
    contactEmail: 'info@daddyjobe.edu.gm',
    registrationCode: 'DJC-CSR-2025',
    admin: {
      fullName: 'Musu Bah',
      email: 'musu.bah@daddyjobe.edu.gm',
      username: 'djc_admin',
      password: 'DjcAdmin@2025'
    },
    departments: [
      {
        name: 'Science',
        hod: {
          fullName: 'Momodou Bojang',
          email: 'momodou.bojang@daddyjobe.edu.gm',
          phone: '+220 781 5470',
          roleKey: 'hod_science',
          username: 'djc_hod_science',
          password: 'DjcScienceHOD@2025',
          permissions: ['department-analytics', 'reports:view']
        }
      },
      {
        name: 'Commerce',
        hod: {
          fullName: 'Isatou Jatta',
          email: 'isatou.jatta@daddyjobe.edu.gm',
          phone: '+220 756 2308',
          roleKey: 'hod_commerce',
          username: 'djc_hod_commerce',
          password: 'DjcCommerceHOD@2025',
          permissions: ['department-analytics', 'reports:view']
        }
      },
      {
        name: 'Arts',
        hod: {
          fullName: 'Ousman Darboe',
          email: 'ousman.darboe@daddyjobe.edu.gm',
          phone: '+220 672 1103',
          roleKey: 'hod_arts',
          username: 'djc_hod_arts',
          password: 'DjcArtsHOD@2025',
          permissions: ['department-analytics', 'reports:view']
        }
      }
    ]
  }
];

const BROADCAST_NOTIFICATIONS: BroadcastNotificationSeed[] = [
  {
    registrationCode: 'NHS-BJL-2025',
    title: 'Welcome to the 2025 Academic Session',
    message: 'All departments have been successfully created. HODs may begin assigning teachers.',
    targetRoles: ['hod', 'teacher', 'student'],
    status: 'sent'
  },
  {
    registrationCode: 'STP-LMN-2025',
    title: 'Department Hierarchy Setup Complete',
    message: 'Admins can now review department dashboards.',
    targetRoles: ['hod'],
    status: 'sent'
  },
  {
    registrationCode: 'DJC-CSR-2025',
    title: 'Department Heads Assigned',
    message: 'Please verify departmental data before teacher assignment begins.',
    targetRoles: ['hod', 'teacher'],
    status: 'sent'
  }
];

type CredentialSummary = {
  role: Role | 'hod';
  email: string;
  username: string;
  fullName: string;
  school?: string;
  registrationCode?: string;
  department?: string;
  passwordPlain: string;
  passwordHash: string;
};

type DepartmentSummary = {
  school: string;
  department: string;
  slug: string;
  registrationCode: string;
};

type SeedSummary = {
  superuser: Omit<CredentialSummary, 'department'>;
  admins: CredentialSummary[];
  hods: CredentialSummary[];
  departments: DepartmentSummary[];
  notifications: Array<{
    school: string;
    registrationCode: string;
    title: string;
    targetRoles: string[];
    status: string;
  }>;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

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

async function upsertDepartment(
  tenantId: string,
  schoolId: string,
  schoolName: string,
  department: DepartmentSeed,
  actorId: string
): Promise<{ id: string; summary: DepartmentSummary }> {
  const pool = getPool();
  const slug = slugify(department.name);
  const departmentId = crypto.randomUUID();

  const result = await pool.query(
    `
      INSERT INTO shared.departments (
        id,
        school_id,
        name,
        slug,
        contact_email,
        contact_phone,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      ON CONFLICT (school_id, slug) DO UPDATE
        SET name = EXCLUDED.name,
            contact_email = EXCLUDED.contact_email,
            contact_phone = EXCLUDED.contact_phone,
            metadata = EXCLUDED.metadata,
            updated_at = NOW()
      RETURNING id
    `,
    [
      departmentId,
      schoolId,
      department.name,
      slug,
      department.hod.email,
      department.hod.phone,
      JSON.stringify({ source: 'seed-phase2', tenantId })
    ]
  );

  const resolvedDepartmentId = result.rows[0].id as string;

  await recordSharedAuditLog({
    userId: actorId,
    action: 'DEPARTMENT_UPSERTED',
    entityType: 'DEPARTMENT',
    entityId: resolvedDepartmentId,
    details: {
      schoolId,
      tenantId,
      name: department.name,
      slug
    }
  });

  return {
    id: resolvedDepartmentId,
    summary: {
      school: schoolName,
      department: department.name,
      slug,
      registrationCode: ''
    }
  };
}

async function upsertUserAccount(options: {
  email: string;
  username: string;
  fullName: string;
  password: string;
  role: Role | 'hod';
  tenantId: string | null;
  schoolId: string | null;
  departmentId?: string | null;
  phone?: string | null;
  isTeachingStaff?: boolean;
}): Promise<{ id: string; passwordHash: string }> {
  const pool = getPool();
  const normalizedEmail = options.email.toLowerCase();
  const normalizedUsername = options.username.toLowerCase();
  const passwordHash = await argon2.hash(options.password);

  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM shared.users WHERE email = $1`,
    [normalizedEmail]
  );

  if (existing.rowCount > 0) {
    const userId = existing.rows[0].id;
    await pool.query(
      `
        UPDATE shared.users
        SET password_hash = $2,
            role = $3,
            tenant_id = $4,
            school_id = $5,
            department_id = $6,
            username = $7,
            full_name = $8,
            phone = $9,
            is_verified = TRUE,
            is_teaching_staff = $10,
            updated_at = NOW()
        WHERE id = $1
      `,
      [
        userId,
        passwordHash,
        options.role,
        options.tenantId,
        options.schoolId,
        options.departmentId ?? null,
        normalizedUsername,
        options.fullName,
        options.phone ?? null,
        options.isTeachingStaff ?? false
      ]
    );
    return { id: userId, passwordHash };
  }

  const userId = crypto.randomUUID();
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
        phone,
        school_id,
        department_id,
        is_teaching_staff
      )
      VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), $6, $7, $8, $9, $10, $11)
    `,
    [
      userId,
      normalizedEmail,
      passwordHash,
      options.role,
      options.tenantId,
      normalizedUsername,
      options.fullName,
      options.phone ?? null,
      options.schoolId,
      options.departmentId ?? null,
      options.isTeachingStaff ?? false
    ]
  );

  return { id: userId, passwordHash };
}

async function ensureNotificationBroadcast(
  tenantId: string | null,
  schoolId: string | null,
  seed: BroadcastNotificationSeed
): Promise<void> {
  const pool = getPool();
  const existing = await pool.query<{ id: string }>(
    `
      SELECT id
      FROM shared.notifications
      WHERE tenant_id = $1
        AND title = $2
        AND message = $3
    `,
    [tenantId, seed.title, seed.message]
  );

  if (existing.rowCount > 0) {
    return;
  }

  const notificationId = crypto.randomUUID();
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
      VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8::jsonb, NOW())
    `,
    [
      notificationId,
      tenantId,
      seed.targetRoles.length === 1 ? seed.targetRoles[0] : null,
      seed.targetRoles,
      seed.title,
      seed.message,
      seed.status,
      JSON.stringify({
        scope: 'broadcast',
        schoolId,
        registrationCode: seed.registrationCode
      })
    ]
  );
}

async function ensureSuperUser(summary: SeedSummary): Promise<string> {
  const pool = getPool();
  const normalizedEmail = SUPERUSER_CREDENTIALS.email.toLowerCase();
  const passwordHash = await argon2.hash(SUPERUSER_CREDENTIALS.password);

  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM shared.users WHERE email = $1`,
    [normalizedEmail]
  );

  let superUserId: string;
  if (existing.rowCount > 0) {
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
          is_teaching_staff
        )
        VALUES ($1, $2, $3, 'superadmin', NULL, TRUE, NOW(), $4, $5, FALSE)
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

  await upsertUserRole(superUserId, 'superadmin', superUserId, { source: 'seed-phase2' });

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

  summary.superuser = {
    role: 'superadmin',
    email: normalizedEmail,
    username: SUPERUSER_CREDENTIALS.username,
    fullName: SUPERUSER_CREDENTIALS.name,
    passwordPlain: SUPERUSER_CREDENTIALS.password,
    passwordHash
  };

  return superUserId;
}

async function ensureSchoolSetup(
  school: SchoolSeed,
  superUserId: string,
  summary: SeedSummary
): Promise<{
  tenantId: string;
  schemaName: string;
  schoolId: string;
  adminId: string;
  adminPasswordHash: string;
}> {
  const pool = getPool();
  const schemaName = createSchemaSlug(school.name);

  const existingTenant = await pool.query<{ id: string }>(
    `SELECT id FROM shared.tenants WHERE schema_name = $1`,
    [schemaName]
  );

  let tenantId: string;
  if (existingTenant.rowCount > 0) {
    tenantId = existingTenant.rows[0].id;
    await runTenantMigrations(pool, schemaName);
    await seedTenant(pool, schemaName);
  } else {
    const tenant = await createTenant(
      {
        name: school.name,
        schemaName,
        subscriptionType: 'paid',
        billingEmail: school.contactEmail
      },
      pool
    );
    tenantId = tenant.id;
  }

  const schoolInsert = await pool.query(
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
            metadata = EXCLUDED.metadata,
            updated_at = NOW()
      RETURNING id
    `,
    [
      crypto.randomUUID(),
      tenantId,
      school.name,
      school.address,
      school.contactPhone,
      school.contactEmail,
      school.registrationCode,
      JSON.stringify({ source: 'seed-phase2' })
    ]
  );

  const schoolId = schoolInsert.rows[0].id as string;

  await recordSharedAuditLog({
    userId: superUserId,
    action: 'SCHOOL_ONBOARDED',
    entityType: 'TENANT',
    entityId: tenantId,
    details: {
      school: school.name,
      schema: schemaName,
      registrationCode: school.registrationCode
    }
  });

  const adminAccount = await upsertUserAccount({
    email: school.admin.email,
    username: school.admin.username,
    fullName: school.admin.fullName,
    password: school.admin.password,
    role: 'admin',
    tenantId,
    schoolId,
    phone: school.admin.phone ?? null,
    isTeachingStaff: false
  });

  await upsertUserRole(adminAccount.id, 'admin', superUserId, { source: 'seed-phase2' });

  summary.admins.push({
    role: 'admin',
    email: school.admin.email.toLowerCase(),
    username: school.admin.username.toLowerCase(),
    fullName: school.admin.fullName,
    school: school.name,
    registrationCode: school.registrationCode,
    passwordPlain: school.admin.password,
    passwordHash: adminAccount.passwordHash
  });

  return {
    tenantId,
    schemaName,
    schoolId,
    adminId: adminAccount.id,
    adminPasswordHash: adminAccount.passwordHash
  };
}

async function seedDepartmentsAndHods(
  school: SchoolSeed,
  context: { tenantId: string; schoolId: string; adminId: string },
  summary: SeedSummary
): Promise<void> {
  for (const department of school.departments) {
    const { id: departmentId } = await upsertDepartment(
      context.tenantId,
      context.schoolId,
      school.name,
      department,
      context.adminId
    );

    summary.departments.push({
      school: school.name,
      department: department.name,
      slug: slugify(department.name),
      registrationCode: school.registrationCode
    });

    const hodAccount = await upsertUserAccount({
      email: department.hod.email,
      username: department.hod.username,
      fullName: department.hod.fullName,
      password: department.hod.password,
      role: 'hod',
      tenantId: context.tenantId,
      schoolId: context.schoolId,
      departmentId,
      phone: department.hod.phone,
      isTeachingStaff: false
    });

    await upsertUserRole(hodAccount.id, 'hod', context.adminId, {
      departmentId,
      roleKey: department.hod.roleKey,
      permissions: department.hod.permissions,
      source: 'seed-phase2'
    });

    await recordSharedAuditLog({
      userId: context.adminId,
      action: 'HOD_UPSERTED',
      entityType: 'USER',
      entityId: hodAccount.id,
      details: {
        email: department.hod.email,
        departmentId,
        roleKey: department.hod.roleKey
      }
    });

    summary.hods.push({
      role: 'hod',
      email: department.hod.email.toLowerCase(),
      username: department.hod.username.toLowerCase(),
      fullName: department.hod.fullName,
      school: school.name,
      registrationCode: school.registrationCode,
      department: department.name,
      passwordPlain: department.hod.password,
      passwordHash: hodAccount.passwordHash
    });
  }
}

async function seedNotifications(
  school: SchoolSeed,
  context: { tenantId: string; schoolId: string },
  summary: SeedSummary
): Promise<void> {
  const notificationSeed = BROADCAST_NOTIFICATIONS.find(
    (notification) => notification.registrationCode === school.registrationCode
  );

  if (!notificationSeed) {
    return;
  }

  await ensureNotificationBroadcast(context.tenantId, context.schoolId, notificationSeed);

  summary.notifications.push({
    school: school.name,
    registrationCode: school.registrationCode,
    title: notificationSeed.title,
    targetRoles: notificationSeed.targetRoles,
    status: notificationSeed.status
  });
}

async function main() {
  const pool = getPool();
  const summary: SeedSummary = {
    superuser: {
      role: 'superadmin',
      email: '',
      username: '',
      fullName: '',
      passwordPlain: '',
      passwordHash: ''
    },
    admins: [],
    hods: [],
    departments: [],
    notifications: []
  };

  try {
    await runMigrations(pool);
    await syncRolePermissions();

    const superUserId = await ensureSuperUser(summary);

    for (const school of SCHOOL_SEEDS) {
      const context = await ensureSchoolSetup(school, superUserId, summary);
      await seedDepartmentsAndHods(school, context, summary);
      await seedNotifications(school, context, summary);
    }

    console.log('[seed] Phase 1 & 2 setup complete.');
    console.log('[seed] School admins reference:', JSON.stringify(schoolAdmins, null, 2));
    console.log('[seed] Summary:', JSON.stringify(summary, null, 2));
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
