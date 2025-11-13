import 'dotenv/config';
import argon2 from 'argon2';
import crypto from 'crypto';
import { getPool, closePool } from '../db/connection';
import { runMigrations } from '../db/runMigrations';
import {
  createSchemaSlug,
  createTenant,
  runTenantMigrations,
  seedTenant,
  withTenantSearchPath
} from '../db/tenantManager';
import { createAdminForSchool } from '../services/superuserService';
import { recordSharedAuditLog } from '../services/auditLogService';

type SchoolSeedInput = {
  name: string;
  city: string;
  addressLine: string;
  contactPhone: string;
  contactEmail: string;
  registrationCode: string;
  admin: {
    email: string;
    name: string;
  };
};

const SUPERUSER_CREDENTIALS = {
  email: process.env.SEED_SUPERUSER_EMAIL ?? 'owner@saas-platform.system',
  password: process.env.SEED_SUPERUSER_PASSWORD ?? 'SuperOwner#2025!',
  name: process.env.SEED_SUPERUSER_NAME ?? 'Platform Owner'
};

const SCHOOL_SEED_DATA: SchoolSeedInput[] = [
  {
    name: 'New Horizon Senior Secondary School – Banjul',
    city: 'Banjul',
    addressLine: 'Leman Street, Banjul',
    contactPhone: '+220 422 7855',
    contactEmail: 'info@newhorizon.edu.gm',
    registrationCode: 'NHSS-2025-GM',
    admin: {
      email: 'admin@newhorizon.edu.gm',
      name: 'Fatoumatta Jallow'
    }
  },
  {
    name: 'St. Peter’s Senior Secondary School – Lamin',
    city: 'Lamin',
    addressLine: 'Saint Peter’s Road, Lamin',
    contactPhone: '+220 439 2121',
    contactEmail: 'support@stpeterslamin.edu.gm',
    registrationCode: 'SPSS-2025-GM',
    admin: {
      email: 'admin@stpeterslamin.edu.gm',
      name: 'George Conteh'
    }
  },
  {
    name: 'Daddy Jobe Comprehensive Senior Secondary School – MDI Road Kanifing',
    city: 'Kanifing',
    addressLine: 'MDI Road, Kanifing Municipal Council',
    contactPhone: '+220 437 5599',
    contactEmail: 'contact@daddyjobe.edu.gm',
    registrationCode: 'DJCS-2025-GM',
    admin: {
      email: 'admin@daddyjobe.edu.gm',
      name: 'Mariama Ceesay'
    }
  }
];

type CredentialRecord = {
  role: 'superadmin' | 'admin';
  email: string;
  password: string;
  school?: string;
  registrationCode?: string;
  tenantId?: string;
  schema?: string;
};

function generateSecurePassword(): string {
  const bytes = crypto
    .randomBytes(5)
    .toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 10);
  return `${bytes}!#${Math.floor(100 + Math.random() * 900)}`;
}

async function ensureSuperUser(credentials: CredentialRecord[]): Promise<string> {
  const pool = getPool();
  const normalisedEmail = SUPERUSER_CREDENTIALS.email.toLowerCase();
  const passwordHash = await argon2.hash(SUPERUSER_CREDENTIALS.password);

  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM shared.users WHERE email = $1`,
    [normalisedEmail]
  );

  let superUserId: string;

  if (existing.rowCount && existing.rows[0]) {
    superUserId = existing.rows[0].id;
    await pool.query(
      `
        UPDATE shared.users
        SET password_hash = $1,
            role = 'superadmin',
            tenant_id = NULL,
            is_verified = TRUE,
            created_at = created_at
        WHERE id = $2
      `,
      [passwordHash, superUserId]
    );
  } else {
    superUserId = crypto.randomUUID();
    await pool.query(
      `
        INSERT INTO shared.users (id, email, password_hash, role, tenant_id, is_verified, created_at)
        VALUES ($1, $2, $3, 'superadmin', NULL, TRUE, NOW())
      `,
      [superUserId, normalisedEmail, passwordHash]
    );
  }

  credentials.push({
    role: 'superadmin',
    email: normalisedEmail,
    password: SUPERUSER_CREDENTIALS.password
  });

  await recordSharedAuditLog({
    userId: superUserId,
    action: 'SUPERUSER_PROVISIONED',
    entityType: 'USER',
    entityId: superUserId,
    details: {
      email: normalisedEmail,
      name: SUPERUSER_CREDENTIALS.name
    }
  });

  return superUserId;
}

async function ensureSchoolSetup(
  school: SchoolSeedInput,
  superUserId: string,
  credentials: CredentialRecord[]
): Promise<void> {
  const pool = getPool();
  const schemaName = createSchemaSlug(school.name);
  const existingTenant = await pool.query<{ id: string }>(
    `SELECT id FROM shared.tenants WHERE schema_name = $1`,
    [schemaName]
  );

  let tenantId: string;
  if (existingTenant.rowCount && existingTenant.rows[0]) {
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

  await withTenantSearchPath(pool, schemaName, async (client) => {
    await client.query(
      `
        INSERT INTO schools (id, name, address, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (name) DO UPDATE
          SET address = EXCLUDED.address,
              updated_at = NOW()
      `,
      [
        crypto.randomUUID(),
        school.name,
        JSON.stringify({
          address: {
            city: school.city,
            street: school.addressLine,
            country: 'The Gambia'
          },
          contact: {
            phone: school.contactPhone,
            email: school.contactEmail
          },
          registrationCode: school.registrationCode
        })
      ]
    );
  });

  const adminPassword = generateSecurePassword();
  await createAdminForSchool(
    tenantId,
    { email: school.admin.email, password: adminPassword, name: school.admin.name },
    superUserId
  );

  credentials.push({
    role: 'admin',
    email: school.admin.email.toLowerCase(),
    password: adminPassword,
    school: school.name,
    registrationCode: school.registrationCode,
    tenantId,
    schema: schemaName
  });

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
}

async function main() {
  const credentials: CredentialRecord[] = [];
  const pool = getPool();
  try {
    await runMigrations(pool);
    const superUserId = await ensureSuperUser(credentials);

    for (const school of SCHOOL_SEED_DATA) {
      await ensureSchoolSetup(school, superUserId, credentials);
    }

    console.log('[seed] SuperUser and school setup complete.');
    console.log('[seed] Credentials:', JSON.stringify(credentials, null, 2));
  } catch (error) {
    console.error('[seed] Failed to complete SuperUser setup', error);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

void main();
