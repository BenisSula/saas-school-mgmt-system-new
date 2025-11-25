/**
 * Base Repository
 *
 * Provides common database operations for all repositories.
 * Implements the Repository pattern for data access abstraction.
 */

import type { PoolClient, QueryResultRow } from 'pg';

export interface BaseEntity {
  id: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface FindOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export interface FilterConditions {
  [key: string]: unknown;
}

/**
 * Base Repository Class
 *
 * Provides common CRUD operations and query building utilities.
 * All domain repositories should extend this class.
 */
export abstract class BaseRepository {
  protected client: PoolClient;
  protected schema: string;
  protected tableName: string;

  constructor(client: PoolClient, schema: string, tableName: string) {
    this.client = client;
    this.schema = schema;
    this.tableName = tableName;
  }

  /**
   * Get fully qualified table name
   */
  protected getTableName(): string {
    return `${this.schema}.${this.tableName}`;
  }

  /**
   * Find entity by ID
   */
  async findById<T extends BaseEntity>(id: string): Promise<T | null> {
    const result = await this.client.query<T>(
      `SELECT * FROM ${this.getTableName()} WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all entities with optional filters
   */
  async findAll<T extends BaseEntity>(
    filters?: FilterConditions,
    options?: FindOptions
  ): Promise<T[]> {
    let query = `SELECT * FROM ${this.getTableName()}`;
    const params: unknown[] = [];
    let paramIndex = 1;

    // Build WHERE clause
    if (filters && Object.keys(filters).length > 0) {
      const conditions: string[] = [];
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          conditions.push(`${key} = $${paramIndex}`);
          params.push(value);
          paramIndex++;
        }
      }
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
    }

    // Add ORDER BY
    if (options?.orderBy) {
      const direction = options.orderDirection || 'ASC';
      query += ` ORDER BY ${options.orderBy} ${direction}`;
    }

    // Add pagination
    if (options?.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(options.limit);
      paramIndex++;
    }
    if (options?.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(options.offset);
    }

    const result = await this.client.query<T>(query, params);
    return result.rows;
  }

  /**
   * Count entities with optional filters
   */
  async count(filters?: FilterConditions): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM ${this.getTableName()}`;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters && Object.keys(filters).length > 0) {
      const conditions: string[] = [];
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          conditions.push(`${key} = $${paramIndex}`);
          params.push(value);
          paramIndex++;
        }
      }
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
    }

    const result = await this.client.query<{ count: string }>(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Create entity
   */
  async create<T extends BaseEntity>(data: Partial<T>): Promise<T> {
    const fields = Object.keys(data).filter(
      (key) => key !== 'id' && key !== 'created_at' && key !== 'updated_at'
    );
    const values = fields.map((_, index) => `$${index + 1}`);
    const params = fields.map((field) => data[field as keyof T]);

    const query = `
      INSERT INTO ${this.getTableName()} (${fields.join(', ')}, created_at, updated_at)
      VALUES (${values.join(', ')}, NOW(), NOW())
      RETURNING *
    `;

    const result = await this.client.query<T>(query, params);
    return result.rows[0];
  }

  /**
   * Update entity by ID
   */
  async updateById<T extends BaseEntity>(id: string, data: Partial<T>): Promise<T | null> {
    const fields = Object.keys(data).filter(
      (key) => key !== 'id' && key !== 'created_at' && key !== 'updated_at'
    );

    if (fields.length === 0) {
      return this.findById<T>(id);
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    const params = [...fields.map((field) => data[field as keyof T]), id];

    const query = `
      UPDATE ${this.getTableName()}
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${fields.length + 1}
      RETURNING *
    `;

    const result = await this.client.query<T>(query, params);
    return result.rows[0] || null;
  }

  /**
   * Delete entity by ID
   */
  async deleteById(id: string): Promise<boolean> {
    const result = await this.client.query(`DELETE FROM ${this.getTableName()} WHERE id = $1`, [
      id,
    ]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Execute raw query (use sparingly, prefer typed methods)
   */
  protected async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> {
    const result = await this.client.query<T>(sql, params);
    return result.rows;
  }

  /**
   * Execute raw query returning single row
   */
  protected async queryOne<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<T | null> {
    const result = await this.client.query<T>(sql, params);
    return result.rows[0] || null;
  }
}
