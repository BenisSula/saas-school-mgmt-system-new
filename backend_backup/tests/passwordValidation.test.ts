import { describe, it, expect } from '@jest/globals';
import { validatePasswordStrength } from '../src/middleware/validation';

describe('Password Strength Validation', () => {
  it('should accept strong password with all requirements', () => {
    const result = validatePasswordStrength('StrongPass123!');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject password shorter than 8 characters', () => {
    const result = validatePasswordStrength('Short1!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must be at least 8 characters long');
  });

  it('should reject password without uppercase letter', () => {
    const result = validatePasswordStrength('lowercase123!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one uppercase letter');
  });

  it('should reject password without lowercase letter', () => {
    const result = validatePasswordStrength('UPPERCASE123!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one lowercase letter');
  });

  it('should reject password without number', () => {
    const result = validatePasswordStrength('NoNumberPass!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one number');
  });

  it('should reject password without symbol', () => {
    const result = validatePasswordStrength('NoSymbolPass123');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one symbol');
  });

  it('should report all missing requirements', () => {
    const result = validatePasswordStrength('weak');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
    expect(result.errors).toContain('Password must be at least 8 characters long');
  });

  it('should accept password with various symbols', () => {
    const symbols = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '+', '='];
    for (const symbol of symbols) {
      const password = `TestPass123${symbol}`;
      const result = validatePasswordStrength(password);
      expect(result.valid).toBe(true);
    }
  });
});

