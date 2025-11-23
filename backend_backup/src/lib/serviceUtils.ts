/**
 * Shared utilities for service layer
 * Consolidates common patterns across services
 */

import { assertValidSchemaName } from '../db/tenantManager';

/**
 * Generate table name with schema prefix
 * Consolidates duplicate tableName functions across services
 */
export function getTableName(schema: string, table: string): string {
  assertValidSchemaName(schema);
  return `${schema}.${table}`;
}

/**
 * Base CRUD query builders
 */
export interface BaseEntity {
  id: string;
  created_at?: Date | string;
  updated_at?: Date | string;
}

/**
 * Build SELECT query with pagination
 */
export function buildSelectQuery(
  schema: string,
  table: string,
  options: {
    where?: string;
    orderBy?: string;
    limit?: number;
    offset?: number;
    columns?: string;
  } = {}
): { query: string; params: unknown[] } {
  const tableName = getTableName(schema, table);
  const columns = options.columns || '*';
  const orderBy = options.orderBy || 'created_at DESC';
  const params: unknown[] = [];
  let query = `SELECT ${columns} FROM ${tableName}`;

  if (options.where) {
    query += ` WHERE ${options.where}`;
  }

  query += ` ORDER BY ${orderBy}`;

  if (options.limit) {
    query += ` LIMIT $${params.length + 1}`;
    params.push(options.limit);
  }

  if (options.offset) {
    query += ` OFFSET $${params.length + 1}`;
    params.push(options.offset);
  }

  return { query, params };
}

/**
 * Build COUNT query
 */
export function buildCountQuery(
  schema: string,
  table: string,
  where?: string
): { query: string; params: unknown[] } {
  const tableName = getTableName(schema, table);
  const params: unknown[] = [];
  let query = `SELECT COUNT(*) as count FROM ${tableName}`;

  if (where) {
    query += ` WHERE ${where}`;
  }

  return { query, params };
}

/**
 * Parse JSON field safely
 */
export function parseJsonField<T>(value: unknown, defaultValue: T): T {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return defaultValue;
    }
  }
  return value as T;
}

/**
 * Serialize JSON field safely
 */
export function serializeJsonField(value: unknown): string {
  if (value === null || value === undefined) {
    return '[]';
  }
  return JSON.stringify(value);
}

