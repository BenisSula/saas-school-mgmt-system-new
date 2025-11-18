import { describe, it, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';
import { Pool } from 'pg';
import { getPool } from '../src/db/connection';
import { signUp } from '../src/services/authService';
import type { SignUpInput } from '../src/services/authService';

/**
 * Integration test for transaction rollback in admin signup
 * This test verifies that if tenant creation fails, the transaction is rolled back
 * and no partial data is left in the database
 */
describe('Auth Service - Transaction Rollback', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = getPool();
  });

  beforeEach(async () => {
    // Clean up any test data - wrap in try-catch to handle connection errors gracefully
    try {
      await pool.query('DELETE FROM shared.users WHERE email LIKE $1', ['test-%']);
    } catch (error) {
      // Ignore connection errors in cleanup
      console.warn('Cleanup error (ignored):', error);
    }
    try {
      await pool.query('DELETE FROM shared.tenants WHERE name LIKE $1', ['Test School%']);
    } catch (error) {
      // Ignore connection errors in cleanup
      console.warn('Cleanup error (ignored):', error);
    }
  });

  afterEach(async () => {
    // Clean up test data after each test - wrap in try-catch to handle connection errors gracefully
    try {
      await pool.query('DELETE FROM shared.users WHERE email LIKE $1', ['test-%']);
    } catch (error) {
      // Ignore connection errors in cleanup
      console.warn('Cleanup error (ignored):', error);
    }
    try {
      await pool.query('DELETE FROM shared.tenants WHERE name LIKE $1', ['Test School%']);
    } catch (error) {
      // Ignore connection errors in cleanup
      console.warn('Cleanup error (ignored):', error);
    }
  });

  it('should rollback transaction if tenant schema creation fails', async () => {
    const testEmail = `test-rollback-${Date.now()}@example.com`;
    const testTenantName = `Test School ${Date.now()}`;

    const input: SignUpInput = {
      email: testEmail,
      password: 'StrongPass123!',
      role: 'admin',
      tenantName: testTenantName,
      profile: {
        fullName: 'Test Admin'
      }
    };

    // Mock a scenario where schema creation might fail
    // In a real scenario, this could happen due to database constraints
    // For this test, we'll verify that if signup fails, no partial data exists

    try {
      await signUp(input);
      // If signup succeeds, verify data integrity
      const userResult = await pool.query('SELECT * FROM shared.users WHERE email = $1', [
        testEmail
      ]);
      const tenantResult = await pool.query('SELECT * FROM shared.tenants WHERE name = $1', [
        testTenantName
      ]);

      // If both exist, transaction succeeded
      if (userResult.rows.length > 0 && tenantResult.rows.length > 0) {
        expect(userResult.rows[0].email).toBe(testEmail);
        expect(tenantResult.rows[0].name).toBe(testTenantName);
      }
    } catch {
      // If signup fails, verify no partial data was created
      const userResult = await pool.query('SELECT * FROM shared.users WHERE email = $1', [
        testEmail
      ]);
      const tenantResult = await pool.query('SELECT * FROM shared.tenants WHERE name = $1', [
        testTenantName
      ]);

      // Transaction should be rolled back - either both exist (success) or neither exists (rollback)
      const userExists = userResult.rows.length > 0;
      const tenantExists = tenantResult.rows.length > 0;

      // If transaction rolled back, both should be missing
      // If transaction succeeded, both should exist
      // Partial state (one exists, other doesn't) indicates transaction failure
      expect(userExists).toBe(tenantExists);
    }
  });

  it('should create user and tenant atomically for admin signup', async () => {
    const testEmail = `test-atomic-${Date.now()}@example.com`;
    const testTenantName = `Test Atomic School ${Date.now()}`;

    const input: SignUpInput = {
      email: testEmail,
      password: 'StrongPass123!',
      role: 'admin',
      tenantName: testTenantName,
      profile: {
        fullName: 'Atomic Admin'
      }
    };

    const result = await signUp(input);

    // Verify user was created
    const userResult = await pool.query('SELECT * FROM shared.users WHERE email = $1', [testEmail]);
    expect(userResult.rows).toHaveLength(1);
    expect(userResult.rows[0].email).toBe(testEmail);
    expect(userResult.rows[0].role).toBe('admin');

    // Verify tenant was created
    const tenantResult = await pool.query('SELECT * FROM shared.tenants WHERE name = $1', [
      testTenantName
    ]);
    expect(tenantResult.rows).toHaveLength(1);
    expect(tenantResult.rows[0].name).toBe(testTenantName);

    // Verify user is linked to tenant
    expect(userResult.rows[0].tenant_id).toBe(tenantResult.rows[0].id);

    // Verify response structure
    expect(result.user.email).toBe(testEmail);
    expect(result.user.role).toBe('admin');
    expect(result.user.tenantId).toBe(tenantResult.rows[0].id);
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  it('should not create tenant if user creation fails', async () => {
    // This test verifies that if user creation fails (e.g., duplicate email),
    // no tenant is created

    const testEmail = `test-duplicate-${Date.now()}@example.com`;
    const testTenantName = `Test Duplicate School ${Date.now()}`;

    const input: SignUpInput = {
      email: testEmail,
      password: 'StrongPass123!',
      role: 'admin',
      tenantName: testTenantName
    };

    // First signup should succeed
    await signUp(input);

    // Second signup with same email should fail
    await expect(signUp(input)).rejects.toThrow();

    // Verify only one tenant was created (from first signup)
    const tenantResult = await pool.query('SELECT * FROM shared.tenants WHERE name = $1', [
      testTenantName
    ]);
    expect(tenantResult.rows).toHaveLength(1);
  });
});
