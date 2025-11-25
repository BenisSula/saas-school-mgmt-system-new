import { describe, it, expect } from 'vitest';
import { normalizeUser, ensureActive, isActive } from '../lib/userUtils';
import type { AuthUser } from '../lib/api';

describe('userUtils', () => {
  const baseUser: AuthUser = {
    id: '123',
    email: 'test@example.com',
    role: 'student',
    tenantId: 'tenant-1',
    isVerified: true,
    status: 'active',
  };

  describe('normalizeUser', () => {
    it('should return user with status when status is provided', () => {
      const user = { ...baseUser, status: 'pending' as const };
      const normalized = normalizeUser(user);
      expect(normalized.status).toBe('pending');
    });

    it('should default to active status when status is undefined', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const user = { ...baseUser, status: undefined as any };
      const normalized = normalizeUser(user);
      expect(normalized.status).toBe('active');
    });

    it('should preserve all other user properties', () => {
      const user = { ...baseUser, status: 'suspended' as const };
      const normalized = normalizeUser(user);
      expect(normalized.id).toBe(user.id);
      expect(normalized.email).toBe(user.email);
      expect(normalized.role).toBe(user.role);
      expect(normalized.tenantId).toBe(user.tenantId);
      expect(normalized.isVerified).toBe(user.isVerified);
    });
  });

  describe('ensureActive', () => {
    it('should not throw for active users', () => {
      const user = { ...baseUser, status: 'active' as const };
      expect(() => ensureActive(user)).not.toThrow();
    });

    it('should throw error for pending users', () => {
      const user = { ...baseUser, status: 'pending' as const };
      expect(() => ensureActive(user)).toThrow('Account pending admin approval.');
    });

    it('should throw error for suspended users', () => {
      const user = { ...baseUser, status: 'suspended' as const };
      expect(() => ensureActive(user)).toThrow('Account inactive.');
    });

    it('should throw error for rejected users', () => {
      const user = { ...baseUser, status: 'rejected' as const };
      expect(() => ensureActive(user)).toThrow('Account inactive.');
    });

    it('should default to active when status is undefined', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const user = { ...baseUser, status: undefined as any };
      expect(() => ensureActive(user)).not.toThrow();
    });
  });

  describe('isActive', () => {
    it('should return true for active users', () => {
      const user = { ...baseUser, status: 'active' as const };
      expect(isActive(user)).toBe(true);
    });

    it('should return false for pending users', () => {
      const user = { ...baseUser, status: 'pending' as const };
      expect(isActive(user)).toBe(false);
    });

    it('should return false for suspended users', () => {
      const user = { ...baseUser, status: 'suspended' as const };
      expect(isActive(user)).toBe(false);
    });

    it('should return true when status is undefined (defaults to active)', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const user = { ...baseUser, status: undefined as any };
      expect(isActive(user)).toBe(true);
    });
  });
});
