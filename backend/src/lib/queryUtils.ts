/**
 * Utility functions for building SQL queries dynamically.
 * Helps reduce duplication and improve maintainability of query building logic.
 */

export interface QueryCondition {
  column: string;
  value: unknown;
  operator?: string;
}

/**
 * Builds a WHERE clause from an array of conditions.
 *
 * @param conditions - Array of condition objects
 * @param startParamIndex - Starting index for parameter placeholders (default: 1)
 * @returns Object with WHERE clause string and parameter values
 *
 * @example
 * const { whereClause, params } = buildWhereClause([
 *   { column: 'status', value: 'active' },
 *   { column: 'role', value: 'teacher' }
 * ]);
 * // Returns: { whereClause: 'WHERE status = $1 AND role = $2', params: ['active', 'teacher'] }
 */
export function buildWhereClause(
  conditions: QueryCondition[],
  startParamIndex = 1
): { whereClause: string; params: unknown[] } {
  if (conditions.length === 0) {
    return { whereClause: '', params: [] };
  }

  const params: unknown[] = [];
  const clauses: string[] = [];
  let paramIndex = startParamIndex;

  for (const condition of conditions) {
    const operator = condition.operator ?? '=';
    clauses.push(`${condition.column} ${operator} $${paramIndex}`);
    params.push(condition.value);
    paramIndex++;
  }

  const whereClause = `WHERE ${clauses.join(' AND ')}`;
  return { whereClause, params };
}

/**
 * Builds a WHERE clause from a simple key-value filter object.
 * Useful for simple equality filters.
 *
 * @param filters - Object with column names as keys and filter values as values
 * @param startParamIndex - Starting index for parameter placeholders (default: 1)
 * @returns Object with WHERE clause string and parameter values
 *
 * @example
 * const { whereClause, params } = buildWhereClauseFromFilters({
 *   status: 'active',
 *   role: 'teacher'
 * });
 * // Returns: { whereClause: 'WHERE status = $1 AND role = $2', params: ['active', 'teacher'] }
 */
export function buildWhereClauseFromFilters(
  filters: Record<string, unknown>,
  startParamIndex = 1
): { whereClause: string; params: unknown[] } {
  const conditions: QueryCondition[] = Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([column, value]) => ({ column, value }));

  return buildWhereClause(conditions, startParamIndex);
}

/**
 * Builds an ORDER BY clause.
 *
 * @param orderBy - Array of column names or objects with column and direction
 * @returns ORDER BY clause string
 *
 * @example
 * buildOrderByClause(['created_at DESC', 'name ASC'])
 * // Returns: 'ORDER BY created_at DESC, name ASC'
 *
 * buildOrderByClause([{ column: 'created_at', direction: 'DESC' }])
 * // Returns: 'ORDER BY created_at DESC'
 */
export function buildOrderByClause(
  orderBy: Array<string | { column: string; direction?: 'ASC' | 'DESC' }>
): string {
  if (orderBy.length === 0) {
    return '';
  }

  const clauses = orderBy.map((item) => {
    if (typeof item === 'string') {
      return item;
    }
    return `${item.column} ${item.direction ?? 'ASC'}`;
  });

  return `ORDER BY ${clauses.join(', ')}`;
}

/**
 * Builds a LIMIT clause.
 *
 * @param limit - Maximum number of rows to return
 * @param offset - Number of rows to skip (optional)
 * @returns LIMIT clause string
 *
 * @example
 * buildLimitClause(10)
 * // Returns: 'LIMIT 10'
 *
 * buildLimitClause(10, 20)
 * // Returns: 'LIMIT 10 OFFSET 20'
 */
export function buildLimitClause(limit: number, offset?: number): string {
  if (offset !== undefined) {
    return `LIMIT ${limit} OFFSET ${offset}`;
  }
  return `LIMIT ${limit}`;
}
