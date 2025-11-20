/**
 * Query Optimization Utilities
 * 
 * Provides helper functions to ensure queries are optimized and don't violate
 * multi-tenant isolation principles.
 */

import { Pool, PoolClient } from 'pg';

/**
 * Validates that a query doesn't join across tenant schemas
 * This is a runtime check for development/testing
 */
export function validateNoCrossTenantJoin(query: string, currentSchema?: string): void {
  // Pattern to detect potential cross-tenant joins
  // This is a simple heuristic - actual validation should be done via code review
  
  const crossTenantPatterns = [
    // Joining tenant schema table with shared.users without tenant_id filter
    /FROM\s+(\w+)\.(\w+)\s+JOIN\s+shared\.users/i,
    // Joining multiple tenant schemas
    /FROM\s+(\w+)\.(\w+)\s+JOIN\s+(\w+)\.(\w+)/i,
  ];

  for (const pattern of crossTenantPatterns) {
    if (pattern.test(query)) {
      console.warn('[queryOptimization] Potential cross-tenant join detected:', query);
    }
  }
}

/**
 * Ensures tenant_id filter is present in WHERE clause for shared.users queries
 */
export function ensureTenantFilter(query: string, tenantId: string): string {
  // This is a helper for building queries - actual implementation should use
  // parameterized queries with proper WHERE clauses
  if (query.includes('FROM shared.users') && !query.includes('tenant_id')) {
    console.warn('[queryOptimization] Query on shared.users missing tenant_id filter');
  }
  return query;
}

/**
 * Optimizes repeated queries by suggesting query patterns
 */
export interface QueryPattern {
  name: string;
  pattern: string;
  indexHint?: string;
  description: string;
}

export const OPTIMIZED_QUERY_PATTERNS: QueryPattern[] = [
  {
    name: 'user_by_email',
    pattern: 'SELECT * FROM shared.users WHERE email = $1',
    indexHint: 'shared_users_email_idx',
    description: 'Use index on email for fast lookups'
  },
  {
    name: 'users_by_tenant_role',
    pattern: 'SELECT * FROM shared.users WHERE tenant_id = $1 AND role = $2',
    indexHint: 'shared_users_tenant_role_idx',
    description: 'Use composite index on (tenant_id, role)'
  },
  {
    name: 'pending_users',
    pattern: 'SELECT * FROM shared.users WHERE tenant_id = $1 AND status = $2 AND pending_profile_data IS NOT NULL',
    indexHint: 'shared_users_pending_profile_tenant_role_idx',
    description: 'Use partial index for pending users with profile data'
  },
  {
    name: 'tenant_by_schema',
    pattern: 'SELECT * FROM shared.tenants WHERE schema_name = $1',
    indexHint: 'shared_tenants_schema_name_idx',
    description: 'Use index on schema_name for tenant resolution'
  }
];

/**
 * Logs slow query warnings (for development)
 */
export function logSlowQuery(query: string, duration: number, threshold: number = 100): void {
  if (duration > threshold) {
    console.warn(`[queryOptimization] Slow query detected (${duration}ms):`, query.substring(0, 200));
  }
}

