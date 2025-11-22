/**
 * Schema Introspection Utilities
 * Provides utilities to inspect and validate tenant schemas
 * DRY: Reusable across maintenance and health check services
 */

import { Pool } from 'pg';

export interface SchemaInfo {
  schemaName: string;
  tableCount: number;
  tables: string[];
  missingTables: string[];
  expectedTables: string[];
}

/**
 * Expected core tables that should exist in every tenant schema
 * Update this list based on your actual schema structure
 */
const EXPECTED_CORE_TABLES = [
  'schools',
  'students',
  'teachers',
  'classes',
  'subjects',
  'attendance_records',
  'grades',
  'exams'
];

/**
 * Inspect a tenant schema and return information about its structure
 * @param pool - Database pool
 * @param schemaName - Schema name to inspect
 */
export async function inspectSchema(pool: Pool, schemaName: string): Promise<SchemaInfo> {
  // Get all tables in the schema
  const tablesResult = await pool.query(
    `SELECT table_name 
     FROM information_schema.tables 
     WHERE table_schema = $1 
     AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
    [schemaName]
  );

  const tables = tablesResult.rows.map((row) => row.table_name);
  const missingTables = EXPECTED_CORE_TABLES.filter((table) => !tables.includes(table));

  return {
    schemaName,
    tableCount: tables.length,
    tables,
    missingTables,
    expectedTables: EXPECTED_CORE_TABLES
  };
}

/**
 * Check if a schema exists
 * @param pool - Database pool
 * @param schemaName - Schema name to check
 */
export async function schemaExists(pool: Pool, schemaName: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT EXISTS(
      SELECT 1 
      FROM information_schema.schemata 
      WHERE schema_name = $1
    )`,
    [schemaName]
  );

  return result.rows[0].exists;
}

/**
 * Get table count for a schema
 * @param pool - Database pool
 * @param schemaName - Schema name
 */
export async function getTableCount(pool: Pool, schemaName: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) as count 
     FROM information_schema.tables 
     WHERE table_schema = $1 
     AND table_type = 'BASE TABLE'`,
    [schemaName]
  );

  return parseInt(result.rows[0].count, 10);
}

