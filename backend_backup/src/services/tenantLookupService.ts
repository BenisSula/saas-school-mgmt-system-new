import { getPool } from '../db/connection';

export interface TenantLookupResult {
  id: string;
  name: string;
  domain: string | null;
  registrationCode: string | null;
}

/**
 * Find tenant by registration code (looks up in shared.schools table)
 * This is the primary method for users to find their school during registration
 */
export async function findTenantByRegistrationCode(
  registrationCode: string
): Promise<TenantLookupResult | null> {
  const pool = getPool();
  const normalizedCode = registrationCode.trim().toUpperCase();

  const result = await pool.query(
    `
      SELECT 
        t.id,
        t.name,
        t.domain,
        s.registration_code
      FROM shared.tenants t
      INNER JOIN shared.schools s ON s.tenant_id = t.id
      WHERE UPPER(TRIM(s.registration_code)) = $1
        AND t.status = 'active'
    `,
    [normalizedCode]
  );

  if (result.rowCount && result.rowCount > 0) {
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      domain: row.domain,
      registrationCode: row.registration_code
    };
  }

  return null;
}

/**
 * Find tenant by name (fuzzy search)
 * Used as fallback when registration code is not available
 */
export async function findTenantByName(
  name: string,
  limit: number = 10
): Promise<TenantLookupResult[]> {
  const pool = getPool();
  const searchTerm = `%${name.trim()}%`;

  const result = await pool.query(
    `
      SELECT DISTINCT
        t.id,
        t.name,
        t.domain,
        s.registration_code
      FROM shared.tenants t
      LEFT JOIN shared.schools s ON s.tenant_id = t.id
      WHERE t.name ILIKE $1
        AND t.status = 'active'
      ORDER BY t.name ASC
      LIMIT $2
    `,
    [searchTerm, limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    domain: row.domain,
    registrationCode: row.registration_code
  }));
}

/**
 * Find tenant by domain
 * Used for subdomain-based tenant resolution
 */
export async function findTenantByDomain(domain: string): Promise<TenantLookupResult | null> {
  const pool = getPool();
  const normalizedDomain = domain.trim().toLowerCase();

  const result = await pool.query(
    `
      SELECT 
        t.id,
        t.name,
        t.domain,
        s.registration_code
      FROM shared.tenants t
      LEFT JOIN shared.schools s ON s.tenant_id = t.id
      WHERE LOWER(TRIM(t.domain)) = $1
        AND t.status = 'active'
    `,
    [normalizedDomain]
  );

  if (result.rowCount && result.rowCount > 0) {
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      domain: row.domain,
      registrationCode: row.registration_code
    };
  }

  return null;
}

/**
 * List all active tenants (for dropdown/autocomplete)
 * Returns a paginated list of schools available for registration
 *
 * @param limit - Maximum number of results (default: 50)
 * @param offset - Number of results to skip (default: 0)
 * @param includeInactive - Whether to include inactive tenants (default: false)
 */
export async function listActiveTenants(
  limit: number = 50,
  offset: number = 0,
  includeInactive: boolean = false
): Promise<{ tenants: TenantLookupResult[]; total: number }> {
  const pool = getPool();

  const statusFilter = includeInactive ? '' : "AND t.status = 'active'";

  // Get total count
  const countResult = await pool.query(
    `
      SELECT COUNT(DISTINCT t.id) as total
      FROM shared.tenants t
      LEFT JOIN shared.schools s ON s.tenant_id = t.id
      WHERE 1=1 ${statusFilter}
    `
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  // Get paginated results
  const result = await pool.query(
    `
      SELECT DISTINCT
        t.id,
        t.name,
        t.domain,
        s.registration_code,
        t.created_at
      FROM shared.tenants t
      LEFT JOIN shared.schools s ON s.tenant_id = t.id
      WHERE 1=1 ${statusFilter}
      ORDER BY t.created_at DESC, t.name ASC
      LIMIT $1 OFFSET $2
    `,
    [limit, offset]
  );

  return {
    tenants: result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      domain: row.domain,
      registrationCode: row.registration_code
    })),
    total
  };
}

/**
 * Get recently added schools (for initial dropdown display)
 * Returns schools added in the last 30 days, ordered by creation date
 */
export async function getRecentSchools(limit: number = 20): Promise<TenantLookupResult[]> {
  const pool = getPool();

  const result = await pool.query(
    `
      SELECT DISTINCT
        t.id,
        t.name,
        t.domain,
        s.registration_code
      FROM shared.tenants t
      LEFT JOIN shared.schools s ON s.tenant_id = t.id
      WHERE t.status = 'active'
        AND t.created_at >= NOW() - INTERVAL '30 days'
      ORDER BY t.created_at DESC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    domain: row.domain,
    registrationCode: row.registration_code
  }));
}

/**
 * Unified tenant lookup - tries multiple methods
 * Priority: registration code > domain > name search
 */
export async function lookupTenant(
  identifier: string,
  method: 'code' | 'domain' | 'name' | 'auto' = 'auto'
): Promise<TenantLookupResult | TenantLookupResult[] | null> {
  if (method === 'code' || method === 'auto') {
    const byCode = await findTenantByRegistrationCode(identifier);
    if (byCode) return byCode;
  }

  if (method === 'domain' || method === 'auto') {
    const byDomain = await findTenantByDomain(identifier);
    if (byDomain) return byDomain;
  }

  if (method === 'name' || method === 'auto') {
    const byName = await findTenantByName(identifier, 1);
    if (byName.length > 0) return byName[0];
  }

  return null;
}
