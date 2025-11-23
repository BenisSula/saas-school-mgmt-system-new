import { describe, it, expect } from '@jest/globals';
import { validateSignupInput, normalizeSignupPayload } from '../src/services/authValidation';
import type { SignUpInputRaw } from '../src/services/authValidation';
import { ValidationError } from '../src/middleware/validation';

describe('Auth Validation', () => {
  describe('validateSignupInput', () => {
    it('should validate and normalize valid student signup input', () => {
      const input: SignUpInputRaw = {
        email: '  Student@Example.COM  ',
        password: 'StrongPass123!',
        role: 'student',
        tenantId: 'tenant-123',
        profile: {
          fullName: 'John Doe',
          gender: 'male',
          dateOfBirth: '2010-01-01'
        }
      };

      const result = validateSignupInput(input);

      expect(result.email).toBe('student@example.com');
      expect(result.password).toBe('StrongPass123!');
      expect(result.role).toBe('student');
      expect(result.tenantId).toBe('tenant-123');
      expect(result.profile).toEqual(input.profile);
    });

    it('should validate and normalize valid teacher signup input', () => {
      const input: SignUpInputRaw = {
        email: 'teacher@school.edu',
        password: 'SecurePass456@',
        role: 'teacher',
        tenantId: 'tenant-456',
        profile: {
          fullName: 'Jane Smith',
          phone: '+1234567890',
          subjects: ['mathematics', 'physics']
        }
      };

      const result = validateSignupInput(input);

      expect(result.email).toBe('teacher@school.edu');
      expect(result.role).toBe('teacher');
      expect(result.tenantId).toBe('tenant-456');
    });

    it('should validate admin signup with tenant name', () => {
      const input: SignUpInputRaw = {
        email: 'admin@newschool.edu',
        password: 'AdminPass789!',
        role: 'admin',
        tenantName: 'New School District'
      };

      const result = validateSignupInput(input);

      expect(result.email).toBe('admin@newschool.edu');
      expect(result.role).toBe('admin');
      expect(result.tenantName).toBe('New School District');
      expect(result.tenantId).toBeUndefined();
    });

    it('should reject invalid email format', () => {
      const input: SignUpInputRaw = {
        email: 'invalid-email',
        password: 'StrongPass123!',
        role: 'student',
        tenantId: 'tenant-123'
      };

      expect(() => validateSignupInput(input)).toThrow('Invalid email format');
      expect(() => {
        try {
          validateSignupInput(input);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          throw error;
        }
      }).toThrow();
    });

    it('should reject weak password (too short)', () => {
      const input: SignUpInputRaw = {
        email: 'student@example.com',
        password: 'Short1!',
        role: 'student',
        tenantId: 'tenant-123'
      };

      expect(() => validateSignupInput(input)).toThrow(/Password validation failed/);
      expect(() => {
        try {
          validateSignupInput(input);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          throw error;
        }
      }).toThrow();
    });

    it('should reject password without uppercase', () => {
      const input: SignUpInputRaw = {
        email: 'student@example.com',
        password: 'lowercase123!',
        role: 'student',
        tenantId: 'tenant-123'
      };

      expect(() => {
        try {
          validateSignupInput(input);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          throw error;
        }
      }).toThrow();
    });

    it('should reject password without lowercase', () => {
      const input: SignUpInputRaw = {
        email: 'student@example.com',
        password: 'UPPERCASE123!',
        role: 'student',
        tenantId: 'tenant-123'
      };

      expect(() => {
        try {
          validateSignupInput(input);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          throw error;
        }
      }).toThrow();
    });

    it('should reject password without number', () => {
      const input: SignUpInputRaw = {
        email: 'student@example.com',
        password: 'NoNumberPass!',
        role: 'student',
        tenantId: 'tenant-123'
      };

      expect(() => {
        try {
          validateSignupInput(input);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          throw error;
        }
      }).toThrow();
    });

    it('should reject password without symbol', () => {
      const input: SignUpInputRaw = {
        email: 'student@example.com',
        password: 'NoSymbolPass123',
        role: 'student',
        tenantId: 'tenant-123'
      };

      expect(() => {
        try {
          validateSignupInput(input);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          throw error;
        }
      }).toThrow();
    });

    it('should reject invalid role', () => {
      const input: SignUpInputRaw = {
        email: 'user@example.com',
        password: 'StrongPass123!',
        role: 'invalid-role' as 'student' | 'teacher' | 'admin',
        tenantId: 'tenant-123'
      };

      expect(() => {
        try {
          validateSignupInput(input);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          throw error;
        }
      }).toThrow();
      expect(() => validateSignupInput(input)).toThrow(/Invalid role/);
    });

    it('should reject superadmin role for self-registration', () => {
      const input: SignUpInputRaw = {
        email: 'superadmin@example.com',
        password: 'StrongPass123!',
        role: 'superadmin' as 'student' | 'teacher' | 'admin',
        tenantId: 'tenant-123'
      };

      expect(() => {
        try {
          validateSignupInput(input);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          throw error;
        }
      }).toThrow();
      expect(() => validateSignupInput(input)).toThrow(/not allowed for self-registration/);
    });

    it('should reject hod role for self-registration', () => {
      const input: SignUpInputRaw = {
        email: 'hod@example.com',
        password: 'StrongPass123!',
        role: 'hod' as 'student' | 'teacher' | 'admin',
        tenantId: 'tenant-123'
      };

      expect(() => {
        try {
          validateSignupInput(input);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          throw error;
        }
      }).toThrow();
    });

    it('should reject admin without tenant name', () => {
      const input: SignUpInputRaw = {
        email: 'admin@example.com',
        password: 'StrongPass123!',
        role: 'admin'
      };

      expect(() => {
        try {
          validateSignupInput(input);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          throw error;
        }
      }).toThrow();
      expect(() => validateSignupInput(input)).toThrow(
        /requires either creating a new organization/
      );
    });

    it('should reject student without tenantId', () => {
      const input: SignUpInputRaw = {
        email: 'student@example.com',
        password: 'StrongPass123!',
        role: 'student'
      };

      expect(() => {
        try {
          validateSignupInput(input);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          throw error;
        }
      }).toThrow();
      expect(() => validateSignupInput(input)).toThrow(/tenantId is required/);
    });

    it('should reject teacher without tenantId', () => {
      const input: SignUpInputRaw = {
        email: 'teacher@example.com',
        password: 'StrongPass123!',
        role: 'teacher'
      };

      expect(() => {
        try {
          validateSignupInput(input);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          throw error;
        }
      }).toThrow();
    });

    it('should sanitize tenant name', () => {
      const input: SignUpInputRaw = {
        email: 'admin@example.com',
        password: 'StrongPass123!',
        role: 'admin',
        tenantName: '  New School @#$% District  '
      };

      const result = validateSignupInput(input);
      expect(result.tenantName).toBe('New School District');
    });

    it('should reject empty email', () => {
      const input: SignUpInputRaw = {
        email: '',
        password: 'StrongPass123!',
        role: 'student',
        tenantId: 'tenant-123'
      };

      expect(() => {
        try {
          validateSignupInput(input);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          throw error;
        }
      }).toThrow();
      expect(() => validateSignupInput(input)).toThrow(/Email is required/);
    });

    it('should reject empty password', () => {
      const input: SignUpInputRaw = {
        email: 'student@example.com',
        password: '',
        role: 'student',
        tenantId: 'tenant-123'
      };

      expect(() => {
        try {
          validateSignupInput(input);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          throw error;
        }
      }).toThrow();
      expect(() => validateSignupInput(input)).toThrow(/Password is required/);
    });
  });

  describe('normalizeSignupPayload', () => {
    it('should normalize email to lowercase and trim', () => {
      const input = {
        email: '  USER@EXAMPLE.COM  ',
        password: 'StrongPass123!',
        role: 'student' as const,
        tenantId: 'tenant-123'
      };

      const result = normalizeSignupPayload(input);
      expect(result.email).toBe('user@example.com');
    });

    it('should trim tenantId and tenantName', () => {
      const input = {
        email: 'user@example.com',
        password: 'StrongPass123!',
        role: 'student' as const,
        tenantId: '  tenant-123  ',
        tenantName: '  School Name  '
      };

      const result = normalizeSignupPayload(input);
      expect(result.tenantId).toBe('tenant-123');
      expect(result.tenantName).toBe('School Name');
    });
  });
});
