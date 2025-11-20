/**
 * Phase 10 - Token Lifecycle Tests
 * 
 * Tests for token generation, validation, refresh, and blacklisting
 */

import { Pool } from 'pg';
import { createTestPool } from './utils/testDb';
import { getPool } from '../src/db/connection';
import {
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  hashTokenValue
} from '../src/services/tokenService';
import type { TokenPayload } from '../src/services/tokenService';
import jwt from 'jsonwebtoken';

jest.mock('../src/db/connection', () => ({
  getPool: jest.fn(),
  closePool: jest.fn()
}));

const mockedGetPool = jest.mocked(getPool);

jest.setTimeout(15000);

describe('Phase 10 - Token Lifecycle Tests', () => {
  let pool: any;
  let tenantId: string;
  let userId: string;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.ACCESS_TOKEN_TTL = '900s';
    process.env.REFRESH_TOKEN_TTL = (60 * 60).toString();

    const testPool = await createTestPool();
    pool = testPool.pool;
    mockedGetPool.mockReturnValue(pool);

    // Create test tenant
    const tenantResult = await pool.query(
      `INSERT INTO shared.tenants (name, domain, schema_name)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['Test School', 'test.local', 'tenant_test']
    );
    tenantId = tenantResult.rows[0].id;

    // Create test user
    const userResult = await pool.query(
      `INSERT INTO shared.users (email, password_hash, role, tenant_id, status, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      ['user@test.local', 'hash', 'admin', tenantId, 'active', true]
    );
    userId = userResult.rows[0].id;
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Access Token Generation', () => {
    it('should generate valid access token', () => {
      const payload: TokenPayload = {
        userId,
        tenantId,
        email: 'user@test.local',
        role: 'admin'
      };

      const token = generateAccessToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token can be decoded
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as any;
      expect(decoded.sub).toBe(userId);
      expect(decoded.email).toBe('user@test.local');
      expect(decoded.role).toBe('admin');
      expect(decoded.tenantId).toBe(tenantId);
    });

    it('should include tokenId in access token', () => {
      const payload: TokenPayload = {
        userId,
        tenantId,
        email: 'user@test.local',
        role: 'admin'
      };

      const token = generateAccessToken(payload);
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as any;

      expect(decoded.tokenId).toBeDefined();
      expect(typeof decoded.tokenId).toBe('string');
    });

    it('should set correct expiration time', () => {
      const payload: TokenPayload = {
        userId,
        tenantId,
        email: 'user@test.local',
        role: 'admin'
      };

      const token = generateAccessToken(payload);
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as any;

      expect(decoded.exp).toBeDefined();
      const expirationTime = decoded.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const expectedExpiration = now + 900 * 1000; // 900 seconds

      // Allow 5 second tolerance
      expect(Math.abs(expirationTime - expectedExpiration)).toBeLessThan(5000);
    });
  });

  describe('Refresh Token Generation', () => {
    it('should generate valid refresh token with expiration', () => {
      const payload: TokenPayload = {
        userId,
        tenantId,
        email: 'user@test.local',
        role: 'admin'
      };

      const { token, expiresAt } = generateRefreshToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(expiresAt).toBeInstanceOf(Date);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should store refresh token in database', async () => {
      const payload: TokenPayload = {
        userId,
        tenantId,
        email: 'user@test.local',
        role: 'admin'
      };

      const { token, expiresAt } = generateRefreshToken(payload);
      await storeRefreshToken(pool, userId, token, expiresAt);

      // Verify token is stored
      const tokenHash = hashTokenValue(token);
      const result = await pool.query(
        `SELECT * FROM shared.refresh_tokens WHERE user_id = $1 AND token_hash = $2`,
        [userId, tokenHash]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].user_id).toBe(userId);
    });

    it('should verify valid refresh token', async () => {
      const payload: TokenPayload = {
        userId,
        tenantId,
        email: 'user@test.local',
        role: 'admin'
      };

      const { token, expiresAt } = generateRefreshToken(payload);
      await storeRefreshToken(pool, userId, token, expiresAt);

      const verified = await verifyRefreshToken(pool, token);

      expect(verified.userId).toBe(userId);
      expect(verified.email).toBe('user@test.local');
      expect(verified.role).toBe('admin');
    });

    it('should reject invalid refresh token', async () => {
      await expect(verifyRefreshToken(pool, 'invalid-token')).rejects.toThrow();
    });

    it('should reject revoked refresh token', async () => {
      const payload: TokenPayload = {
        userId,
        tenantId,
        email: 'user@test.local',
        role: 'admin'
      };

      const { token, expiresAt } = generateRefreshToken(payload);
      await storeRefreshToken(pool, userId, token, expiresAt);

      // Revoke token
      await revokeRefreshToken(pool, token);

      // Verify token is rejected
      await expect(verifyRefreshToken(pool, token)).rejects.toThrow();
    });
  });

  describe('Token Blacklisting', () => {
    it('should revoke refresh token', async () => {
      const payload: TokenPayload = {
        userId,
        tenantId,
        email: 'user@test.local',
        role: 'admin'
      };

      const { token, expiresAt } = generateRefreshToken(payload);
      await storeRefreshToken(pool, userId, token, expiresAt);

      // Revoke token
      await revokeRefreshToken(pool, token);

      // Verify token is removed from database
      const tokenHash = hashTokenValue(token);
      const result = await pool.query(
        `SELECT * FROM shared.refresh_tokens WHERE user_id = $1 AND token_hash = $2`,
        [userId, tokenHash]
      );

      expect(result.rows.length).toBe(0);
    });

    it('should handle revoking non-existent token gracefully', async () => {
      await expect(revokeRefreshToken(pool, 'non-existent-token')).resolves.not.toThrow();
    });
  });

  describe('Token Hash Function', () => {
    it('should generate consistent hash for same token', () => {
      const token = 'test-token-123';
      const hash1 = hashTokenValue(token);
      const hash2 = hashTokenValue(token);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different tokens', () => {
      const token1 = 'test-token-1';
      const token2 = 'test-token-2';
      const hash1 = hashTokenValue(token1);
      const hash2 = hashTokenValue(token2);

      expect(hash1).not.toBe(hash2);
    });
  });
});

