import { describe, it, expect } from '@jest/globals';
import {
  validatePassword,
  getDefaultPasswordPolicy,
} from '../src/services/security/passwordPolicyService';

describe('Password Strength Validation', () => {
  const defaultPolicy = getDefaultPasswordPolicy();

  it('should accept strong password with all requirements', () => {
    const result = validatePassword('StrongPass123!', defaultPolicy);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject password shorter than 8 characters', () => {
    const result = validatePassword('Short1!', defaultPolicy);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must be at least 8 characters long');
  });

  it('should reject password without uppercase letter', () => {
    const result = validatePassword('lowercase123!', defaultPolicy);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one uppercase letter');
  });

  it('should reject password without lowercase letter', () => {
    const result = validatePassword('UPPERCASE123!', defaultPolicy);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one lowercase letter');
  });

  it('should reject password without number', () => {
    const result = validatePassword('NoNumberPass!', defaultPolicy);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one number');
  });

  it('should reject password without symbol', () => {
    const result = validatePassword('NoSymbolPass123', defaultPolicy);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one special character');
  });

  it('should report all missing requirements', () => {
    const result = validatePassword('weak', defaultPolicy);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
    expect(result.errors).toContain('Password must be at least 8 characters long');
  });

  it('should accept password with various symbols', () => {
    const symbols = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '+', '='];
    for (const symbol of symbols) {
      const password = `TestPass123${symbol}`;
      const result = validatePassword(password, defaultPolicy);
      expect(result.isValid).toBe(true);
    }
  });
});
