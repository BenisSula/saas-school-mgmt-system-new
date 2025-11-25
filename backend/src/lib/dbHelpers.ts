/**
 * Database Helper Utilities
 * DRY principle: Centralized database connection and table existence checks
 */

import type { Pool, PoolClient } from 'pg';
import { getPool } from '../db/connection';

/**
 * Execute a function with a database client, automatically handling connection and release.
 * This eliminates the repetitive pattern of pool.connect(), try/finally, client.release()
 */
export async function withDbClient<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    return await operation(client);
  } finally {
    client.release();
  }
}

/**
 * Check if a table exists in a schema.
 * Cached result to avoid repeated queries for the same table.
 * Supports both Pool and PoolClient for flexibility.
 */
const tableExistenceCache = new Map<string, boolean>();
const tableExistenceCacheTime = new Map<string, number>();
const TABLE_EXISTENCE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Function overloads for tableExists (PoolClient and Pool support)
/* eslint-disable no-redeclare */
// Overload for PoolClient
export async function tableExists(
  client: PoolClient,
  schema: string,
  tableName: string
): Promise<boolean>;
// Overload for Pool
export async function tableExists(pool: Pool, schema: string, tableName: string): Promise<boolean>;
// Implementation
export async function tableExists(
  clientOrPool: PoolClient | Pool,
  schema: string,
  tableName: string
): Promise<boolean> {
  /* eslint-enable no-redeclare */
  const cacheKey = `${schema}.${tableName}`;
  const now = Date.now();

  // Check cache first
  if (tableExistenceCache.has(cacheKey)) {
    const cachedTime = tableExistenceCacheTime.get(cacheKey);
    if (cachedTime && now - cachedTime < TABLE_EXISTENCE_CACHE_TTL_MS) {
      return tableExistenceCache.get(cacheKey)!;
    }
  }

  // Query database
  try {
    const result = await clientOrPool.query(
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

/**
 * Check if a column exists in a table.
 */
export async function columnExists(
  client: PoolClient,
  schema: string,
  tableName: string,
  columnName: string
): Promise<boolean> {
  try {
    const result = await client.query(
      `
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = $1 
          AND table_name = $2
          AND column_name = $3
        )
      `,
      [schema, tableName, columnName]
    );

    return result.rows[0]?.exists || false;
  } catch {
    return false;
  }
}

/**
 * Clear the table existence cache (useful for tests or after migrations)
 */
export function clearTableExistenceCache(): void {
  tableExistenceCache.clear();
  tableExistenceCacheTime.clear();
}
