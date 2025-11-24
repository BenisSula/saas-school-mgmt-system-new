import { describe, it, expect } from '@jest/globals';
import {
  buildWhereClause,
  buildWhereClauseFromFilters,
  buildOrderByClause,
  buildLimitClause,
} from '../src/lib/queryUtils';

describe('queryUtils', () => {
  describe('buildWhereClause', () => {
    it('should return empty string and empty params for no conditions', () => {
      const result = buildWhereClause([]);
      expect(result.whereClause).toBe('');
      expect(result.params).toEqual([]);
    });

    it('should build WHERE clause with single condition', () => {
      const result = buildWhereClause([{ column: 'status', value: 'active' }]);
      expect(result.whereClause).toBe('WHERE status = $1');
      expect(result.params).toEqual(['active']);
    });

    it('should build WHERE clause with multiple conditions', () => {
      const result = buildWhereClause([
        { column: 'status', value: 'active' },
        { column: 'role', value: 'teacher' },
      ]);
      expect(result.whereClause).toBe('WHERE status = $1 AND role = $2');
      expect(result.params).toEqual(['active', 'teacher']);
    });

    it('should use custom operator when provided', () => {
      const result = buildWhereClause([
        { column: 'created_at', value: '2024-01-01', operator: '>=' },
      ]);
      expect(result.whereClause).toBe('WHERE created_at >= $1');
      expect(result.params).toEqual(['2024-01-01']);
    });

    it('should start parameter index from custom value', () => {
      const result = buildWhereClause([{ column: 'status', value: 'active' }], 3);
      expect(result.whereClause).toBe('WHERE status = $3');
      expect(result.params).toEqual(['active']);
    });
  });

  describe('buildWhereClauseFromFilters', () => {
    it('should return empty string and empty params for empty filters', () => {
      const result = buildWhereClauseFromFilters({});
      expect(result.whereClause).toBe('');
      expect(result.params).toEqual([]);
    });

    it('should build WHERE clause from filter object', () => {
      const result = buildWhereClauseFromFilters({
        status: 'active',
        role: 'teacher',
      });
      expect(result.whereClause).toBe('WHERE status = $1 AND role = $2');
      expect(result.params).toEqual(['active', 'teacher']);
    });

    it('should filter out undefined and null values', () => {
      const result = buildWhereClauseFromFilters({
        status: 'active',
        role: undefined,
        tenant_id: null,
        verified: true,
      });
      expect(result.whereClause).toBe('WHERE status = $1 AND verified = $2');
      expect(result.params).toEqual(['active', true]);
    });

    it('should handle numeric and boolean values', () => {
      const result = buildWhereClauseFromFilters({
        id: 123,
        is_verified: true,
        count: 0,
      });
      expect(result.whereClause).toBe('WHERE id = $1 AND is_verified = $2 AND count = $3');
      expect(result.params).toEqual([123, true, 0]);
    });

    it('should handle table-prefixed column names', () => {
      const result = buildWhereClauseFromFilters({
        'u.tenant_id': 'test-tenant-id',
        'u.status': 'active',
      });
      expect(result.whereClause).toBe('WHERE u.tenant_id = $1 AND u.status = $2');
      expect(result.params).toEqual(['test-tenant-id', 'active']);
    });
  });

  describe('buildOrderByClause', () => {
    it('should return empty string for empty array', () => {
      expect(buildOrderByClause([])).toBe('');
    });

    it('should build ORDER BY from string array', () => {
      expect(buildOrderByClause(['created_at DESC', 'name ASC'])).toBe(
        'ORDER BY created_at DESC, name ASC'
      );
    });

    it('should build ORDER BY from object array', () => {
      expect(
        buildOrderByClause([
          { column: 'created_at', direction: 'DESC' },
          { column: 'name', direction: 'ASC' },
        ])
      ).toBe('ORDER BY created_at DESC, name ASC');
    });

    it('should default to ASC when direction not specified', () => {
      expect(buildOrderByClause([{ column: 'name' }])).toBe('ORDER BY name ASC');
    });

    it('should handle mixed string and object array', () => {
      expect(buildOrderByClause(['created_at DESC', { column: 'name', direction: 'ASC' }])).toBe(
        'ORDER BY created_at DESC, name ASC'
      );
    });
  });

  describe('buildLimitClause', () => {
    it('should build LIMIT clause without offset', () => {
      expect(buildLimitClause(10)).toBe('LIMIT 10');
    });

    it('should build LIMIT clause with offset', () => {
      expect(buildLimitClause(10, 20)).toBe('LIMIT 10 OFFSET 20');
    });

    it('should handle zero limit', () => {
      expect(buildLimitClause(0)).toBe('LIMIT 0');
    });
  });
});
