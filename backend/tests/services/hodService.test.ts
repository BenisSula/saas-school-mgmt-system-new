/**
 * Unit tests for HOD Service
 * Tests HOD-specific business logic
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { PoolClient } from 'pg';
import {
  getHodOverview,
  listTeachersUnderHOD,
  getDepartmentReport,
} from '../../src/services/hodService';
import { getUserWithAdditionalRoles } from '../../src/lib/roleUtils';

// Mock dependencies
jest.mock('../../src/db/connection');
jest.mock('../../src/lib/roleUtils');
jest.mock('../../src/services/shared/adminHelpers');
jest.mock('../../src/services/audit/enhancedAuditService');

describe('HOD Service', () => {
  let mockClient: Partial<PoolClient>;
  const tenantId = 'test-tenant-id';
  const schema = 'test_schema';
  const hodUserId = 'test-hod-user-id';

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
    };
  });

  describe('getHodOverview', () => {
    it('should throw error if HOD user not found', async () => {
      (getUserWithAdditionalRoles as jest.Mock).mockResolvedValue(null);

      await expect(
        getHodOverview(mockClient as PoolClient, tenantId, schema, hodUserId)
      ).rejects.toThrow('HOD user not found');
    });

    it('should throw error if HOD not assigned to department', async () => {
      (getUserWithAdditionalRoles as jest.Mock).mockResolvedValue({
        id: hodUserId,
        role: 'teacher',
        additional_roles: [], // No HOD role
      });

      await expect(
        getHodOverview(mockClient as PoolClient, tenantId, schema, hodUserId)
      ).rejects.toThrow('HOD is not assigned to a department');
    });

    // Add more test cases for successful scenarios
  });

  describe('listTeachersUnderHOD', () => {
    it('should throw error if HOD user not found', async () => {
      (getUserWithAdditionalRoles as jest.Mock).mockResolvedValue(null);

      await expect(
        listTeachersUnderHOD(mockClient as PoolClient, tenantId, schema, hodUserId)
      ).rejects.toThrow('HOD user not found');
    });

    // Add more test cases
  });

  describe('getDepartmentReport', () => {
    it('should throw error if HOD user not found', async () => {
      (getUserWithAdditionalRoles as jest.Mock).mockResolvedValue(null);

      await expect(
        getDepartmentReport(mockClient as PoolClient, tenantId, schema, hodUserId)
      ).rejects.toThrow('HOD user not found');
    });

    // Add more test cases
  });
});
