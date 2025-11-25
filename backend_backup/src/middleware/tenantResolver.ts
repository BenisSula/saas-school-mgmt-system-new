import { Request, Response, NextFunction } from 'express';
import type { PoolClient } from 'pg';
import { getPool } from '../db/connection';

function isValidSchemaName(schemaName: string): boolean {
  return /^[a-zA-Z0-9_]+$/.test(schemaName);
}

interface TenantRecord {
  id: string;
  schema_name: string;
  name: string;
}

export interface TenantContext {
  id: string;
  schema: string;
  name: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    tenant?: TenantContext;
    tenantClient?: PoolClient;
  }
}

interface TenantResolverOptions {
  optional?: boolean;
}

function extractHostTenant(host?: string | null): string | null {
  if (!host) return null;
  const [hostname] = host.split(':');
  if (!hostname) return null;

  const parts = hostname.split('.');
  if (parts.length < 3) {
    return null;
  }

  return parts[0];
}

async function findTenant(identifier: string): Promise<TenantRecord | undefined> {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT id, schema_name, name
      FROM shared.tenants
      WHERE id::text = $1
         OR schema_name = $1
         OR domain = $1
    `,
    [identifier]
  );

  if (typeof result.rowCount === 'number' && result.rowCount > 0) {
    return result.rows[0] as TenantRecord;
  }

  return undefined;
}

export function tenantResolver(options: TenantResolverOptions = {}) {
  const { optional = false } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.tenant) {
      return next();
    }

    const isSuperadmin = req.user?.role === 'superadmin';
    if (isSuperadmin && optional) {
      return next();
    }

    // Priority order for tenant resolution:
    // 1. JWT token tenantId (for admins and other tenant-scoped users)
    // 2. x-tenant-id header
    // 3. Host header
    const jwtTenantId = req.user?.tenantId;
    const headerTenant = req.header('x-tenant-id');
    const hostTenant = extractHostTenant(req.headers.host);
    const identifier = jwtTenantId || headerTenant || hostTenant;

    if (!identifier || identifier === '') {
      if (optional || isSuperadmin) {
        return next();
      }
      // For non-superadmin users, tenant context is required
      if (req.user && !isSuperadmin) {
        return res.status(403).json({
          message: 'Tenant context required. Please ensure you are assigned to a tenant.'
        });
      }
      return res.status(400).json({ message: 'Tenant context missing' });
    }

    const tenant = await findTenant(identifier);

    if (!tenant) {
      if (optional || isSuperadmin) {
        return next();
      }
      return res.status(404).json({ message: 'Tenant not found' });
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      if (!isValidSchemaName(tenant.schema_name)) {
        throw new Error('Invalid tenant schema');
      }
      await client.query(`SET search_path TO ${tenant.schema_name}, public`);
    } catch (error) {
      client.release();
      throw error;
    }

    req.tenant = {
      id: tenant.id,
      schema: tenant.schema_name,
      name: tenant.name
    };
    req.tenantClient = client;

    const cleanup = async () => {
      const client = req.tenantClient;
      req.tenantClient = undefined;

      if (client) {
        await client.query('SET search_path TO public');
        client.release();
      }
    };

    res.on('finish', cleanup);
    res.on('close', cleanup);

    return next();
  };
}

export default tenantResolver;
