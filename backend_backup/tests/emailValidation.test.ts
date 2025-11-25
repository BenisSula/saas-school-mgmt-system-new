import { describe, it, expect } from '@jest/globals';
import { validateEmailFormat } from '../src/middleware/validation';

describe('Email Format Validation', () => {
  it('should accept valid email addresses', () => {
    const validEmails = [
      'user@example.com',
      'student@school.edu',
      'teacher.name@university.ac.uk',
      'user+tag@example.co.uk',
      'user_name@example-domain.com',
      '123@example.com',
      'user@subdomain.example.com'
    ];

    for (const email of validEmails) {
      expect(validateEmailFormat(email)).toBe(true);
    }
  });

  it('should reject invalid email addresses', () => {
    const invalidEmails = [
      'invalid-email',
      '@example.com',
      'user@',
      'user@.com',
      'user@example',
      'user name@example.com',
      'user@exam ple.com',
      '',
      '   ',
      'user@@example.com'
    ];

    for (const email of invalidEmails) {
      expect(validateEmailFormat(email)).toBe(false);
    }
  });

  it('should handle null and undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(validateEmailFormat(null as any)).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(validateEmailFormat(undefined as any)).toBe(false);
  });

  it('should trim whitespace before validation', () => {
    expect(validateEmailFormat('  user@example.com  ')).toBe(true);
    expect(validateEmailFormat('  invalid  ')).toBe(false);
  });
});
