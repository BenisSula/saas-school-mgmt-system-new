import { describe, it, expect } from '@jest/globals';
import { validateRole, ALLOWED_ROLES } from '../src/middleware/validation';
import { Role } from '../src/config/permissions';

describe('Role Validation', () => {
  it('should accept all allowed roles', () => {
    for (const role of ALLOWED_ROLES) {
      expect(validateRole(role)).toBe(true);
    }
  });

  it('should reject invalid roles', () => {
    const invalidRoles = ['invalid', 'guest', 'moderator', 'superuser', '', 'student ', ' teacher'];

    for (const role of invalidRoles) {
      expect(validateRole(role)).toBe(false);
    }
  });

  it('should be case-sensitive', () => {
    expect(validateRole('Student')).toBe(false);
    expect(validateRole('STUDENT')).toBe(false);
    expect(validateRole('student')).toBe(true);
  });

  it('should work with type guard', () => {
    const testRole = 'student';
    if (validateRole(testRole)) {
      // TypeScript should narrow the type here
      const role = testRole as Role;
      expect(role).toBe('student');
    }
  });
});
