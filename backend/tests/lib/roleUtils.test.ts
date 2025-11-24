/**
 * Unit tests for Role Utilities
 * Tests role checking functions
 */

import { describe, it, expect } from '@jest/globals';
import {
  hasAdditionalRole,
  isHOD,
  getAllUserRoles,
  getHODDepartmentId,
} from '../../src/lib/roleUtils';
import type { UserWithRoles } from '../../src/lib/roleUtils';

describe('Role Utilities', () => {
  describe('hasAdditionalRole', () => {
    it('should return true if user has the additional role', () => {
      const user: UserWithRoles = {
        id: 'user-1',
        role: 'teacher',
        additional_roles: [{ role: 'hod', granted_at: '2025-01-01T00:00:00Z' }],
      };

      expect(hasAdditionalRole(user, 'hod')).toBe(true);
    });

    it('should return false if user does not have the additional role', () => {
      const user: UserWithRoles = {
        id: 'user-1',
        role: 'teacher',
        additional_roles: [],
      };

      expect(hasAdditionalRole(user, 'hod')).toBe(false);
    });

    it('should return false if user is null', () => {
      expect(hasAdditionalRole(null, 'hod')).toBe(false);
    });
  });

  describe('isHOD', () => {
    it('should return true if user has HOD additional role', () => {
      const user: UserWithRoles = {
        id: 'user-1',
        role: 'teacher',
        additional_roles: [{ role: 'hod', granted_at: '2025-01-01T00:00:00Z' }],
      };

      expect(isHOD(user)).toBe(true);
    });

    it('should return false if user does not have HOD role', () => {
      const user: UserWithRoles = {
        id: 'user-1',
        role: 'teacher',
        additional_roles: [],
      };

      expect(isHOD(user)).toBe(false);
    });
  });

  describe('getAllUserRoles', () => {
    it('should return primary role and additional roles', () => {
      const user: UserWithRoles = {
        id: 'user-1',
        role: 'teacher',
        additional_roles: [
          { role: 'hod', granted_at: '2025-01-01T00:00:00Z' },
          { role: 'class_teacher', granted_at: '2025-01-01T00:00:00Z' },
        ],
      };

      const roles = getAllUserRoles(user);
      expect(roles).toContain('teacher');
      expect(roles).toContain('hod');
      expect(roles).toContain('class_teacher');
    });

    it('should return only primary role if no additional roles', () => {
      const user: UserWithRoles = {
        id: 'user-1',
        role: 'teacher',
        additional_roles: [],
      };

      const roles = getAllUserRoles(user);
      expect(roles).toEqual(['teacher']);
    });
  });

  describe('getHODDepartmentId', () => {
    it('should return department ID from HOD metadata', () => {
      const user: UserWithRoles = {
        id: 'user-1',
        role: 'teacher',
        additional_roles: [
          {
            role: 'hod',
            granted_at: '2025-01-01T00:00:00Z',
            metadata: { departmentId: 'dept-123' },
          },
        ],
      };

      expect(getHODDepartmentId(user)).toBe('dept-123');
    });

    it('should return null if user is not HOD', () => {
      const user: UserWithRoles = {
        id: 'user-1',
        role: 'teacher',
        additional_roles: [],
      };

      expect(getHODDepartmentId(user)).toBeNull();
    });

    it('should return null if metadata does not contain departmentId', () => {
      const user: UserWithRoles = {
        id: 'user-1',
        role: 'teacher',
        additional_roles: [
          {
            role: 'hod',
            granted_at: '2025-01-01T00:00:00Z',
            metadata: {},
          },
        ],
      };

      expect(getHODDepartmentId(user)).toBeNull();
    });
  });
});
