/**
 * BACKUP: Original tableExists implementation from platformMetricsService.ts
 * Date: 2025-11-25
 * This file preserves the original implementation before consolidation
 */

// Cache table existence checks to avoid repeated queries
let tableExistenceCache: Map<string, boolean> = new Map();
const TABLE_EXISTENCE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let tableExistenceCacheTime: Map<string, number> = new Map();

/**
 * Check if a table exists (with caching)
 * ORIGINAL IMPLEMENTATION - Now replaced with import from dbHelpers
 */
async function tableExists(pool: Pool, schema: string, tableName: string): Promise<boolean> {
  const cacheKey = `${schema}.${tableName}`;
  const now = Date.now();

  // Check cache
  if (tableExistenceCache.has(cacheKey)) {
    const cacheTime = tableExistenceCacheTime.get(cacheKey) || 0;
    if (now - cacheTime < TABLE_EXISTENCE_CACHE_TTL) {
      return tableExistenceCache.get(cacheKey)!;
    }
  }

  // Query database
  try {
    const result = await pool.query(
      `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 
          AND table_name = $2
        )
      `,
      [schema, tableName]
    );

    const exists = result.rows[0]?.exists || false;

    // Update cache
    tableExistenceCache.set(cacheKey, exists);
    tableExistenceCacheTime.set(cacheKey, now);

    return exists;
  } catch {
    // On error, assume table doesn't exist and cache negative result
    tableExistenceCache.set(cacheKey, false);
    tableExistenceCacheTime.set(cacheKey, now);
    return false;
  }
}

