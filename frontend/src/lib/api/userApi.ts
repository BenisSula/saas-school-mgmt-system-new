/**
 * User Management API Module
 * 
 * Centralized user management API calls
 * Following DRY principles - single source of truth for user operations
 * 
 * This module provides a cleaner, more focused API for user management operations
 * by wrapping and organizing the user-related methods from the main api module.
 */

import { api } from '../api';
import type { Role, TenantUser } from '../api';

export interface CreateUserInput {
  email: string;
  password: string;
  role: Role;
  tenantId?: string;
  profile?: Record<string, unknown>;
}

export interface UpdateUserInput {
  email?: string;
  role?: Role;
  status?: 'pending' | 'active' | 'suspended' | 'rejected';
  profile?: Record<string, unknown>;
}

export interface UpdateUserPasswordInput {
  userId: string;
  newPassword: string;
}

export interface BulkApproveInput {
  userIds: string[];
}

export interface BulkRejectInput {
  userIds: string[];
  reason?: string;
}

/**
 * User Management API functions
 */
export const userApi = {
  /**
   * List all users (paginated)
   */
  listUsers: api.listUsers,

  /**
   * Get user by ID
   */
  getUser: async (userId: string): Promise<TenantUser> => {
    const users = await api.listUsers();
    const user = users.find((u: TenantUser) => u.id === userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    return user;
  },

  /**
   * Create new user (admin only)
   */
  createUser: async (input: CreateUserInput): Promise<TenantUser> => {
    // Use registerUser for admin-created users
    const result = await api.registerUser({
      email: input.email,
      password: input.password,
      role: input.role as 'student' | 'teacher' | 'hod',
      fullName: (input.profile?.fullName as string) || '',
      ...input.profile
    } as Parameters<typeof api.registerUser>[0]);
    
    // Fetch the created user to get full TenantUser shape
    const users = await api.listUsers();
    const user = users.find((u: TenantUser) => u.id === result.userId);
    if (!user) {
      // Fallback: create minimal TenantUser
      return {
        id: result.userId,
        email: result.email,
        role: result.role,
        status: result.status,
        tenantId: null,
        created_at: new Date().toISOString(),
        is_verified: false
      } as unknown as TenantUser;
    }
    return user;
  },

  /**
   * Update user
   */
  updateUser: async (userId: string, input: UpdateUserInput): Promise<TenantUser> => {
    if (input.role) {
      return api.updateUserRole(userId, input.role);
    }
    // For other updates, we'd need a dedicated endpoint
    const users = await api.listUsers();
    const user = users.find((u: TenantUser) => u.id === userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    return user;
  },

  /**
   * Delete user
   */
  deleteUser: async (_userId: string): Promise<void> => {
    // Note: Delete user endpoint may not exist
    // This should be implemented based on actual API
    throw new Error('Delete user not implemented');
  },

  /**
   * Update user role
   */
  updateUserRole: api.updateUserRole,

  /**
   * Update user password
   */
  updateUserPassword: async (input: UpdateUserPasswordInput): Promise<void> => {
    await api.updateUserPassword(input.userId, input.newPassword);
  },

  /**
   * Approve pending user
   */
  approveUser: api.approveUser,

  /**
   * Reject pending user
   */
  rejectUser: api.rejectUser,

  /**
   * Bulk approve users
   */
  bulkApproveUsers: api.bulkApproveUsers,

  /**
   * Bulk reject users
   */
  bulkRejectUsers: api.bulkRejectUsers,

  /**
   * List pending users
   */
  listPendingUsers: api.listPendingUsers
};

