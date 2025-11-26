/**
 * RBAC Middleware Unit Tests
 * Tests role and permission enforcement
 */

import { describe, it, expect, beforeEach, vi } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { requireRole, requirePermission, requireSuperuser } from '../../src/middleware/rbac';

describe('RBAC Middleware', () => {
  let mockRequest: Partial<Request & { user?: { id: string; role: string; tenantId: string; email: string; tokenId: string } }>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      method: 'GET',
      path: '/test',
      originalUrl: '/test',
    };
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('requireRole', () => {
    it('should allow access if user has required role', async () => {
      mockRequest.user = {
        id: 'user-1',
        role: 'admin',
        tenantId: 'tenant-1',
        email: 'admin@test.com',
        tokenId: 'token-1',
      };

      const middleware = requireRole(['admin', 'teacher']);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny access if user does not have required role', async () => {
      mockRequest.user = {
        id: 'user-1',
        role: 'student',
        tenantId: 'tenant-1',
        email: 'student@test.com',
        tokenId: 'token-1',
      };

      const middleware = requireRole(['admin', 'teacher']);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow superadmin if admin is in allowed roles', async () => {
      mockRequest.user = {
        id: 'user-1',
        role: 'superadmin',
        tenantId: 'tenant-1',
        email: 'super@test.com',
        tokenId: 'token-1',
      };

      const middleware = requireRole(['admin']);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 401 if user is not authenticated', async () => {
      mockRequest.user = undefined;

      const middleware = requireRole(['admin']);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requirePermission', () => {
    it('should allow access if user has required permission', () => {
      mockRequest.user = {
        id: 'user-1',
        role: 'admin',
        tenantId: 'tenant-1',
        email: 'admin@test.com',
        tokenId: 'token-1',
      };

      const middleware = requirePermission('users:manage');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny access if user does not have required permission', () => {
      mockRequest.user = {
        id: 'user-1',
        role: 'student',
        tenantId: 'tenant-1',
        email: 'student@test.com',
        tokenId: 'token-1',
      };

      const middleware = requirePermission('users:manage');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if user is not authenticated', () => {
      mockRequest.user = undefined;

      const middleware = requirePermission('users:manage');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireSuperuser', () => {
    it('should allow access if user is superadmin', () => {
      mockRequest.user = {
        id: 'user-1',
        role: 'superadmin',
        tenantId: 'tenant-1',
        email: 'super@test.com',
        tokenId: 'token-1',
      };

      const middleware = requireSuperuser();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny access if user is not superadmin', () => {
      mockRequest.user = {
        id: 'user-1',
        role: 'admin',
        tenantId: 'tenant-1',
        email: 'admin@test.com',
        tokenId: 'token-1',
      };

      const middleware = requireSuperuser();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if user is not authenticated', () => {
      mockRequest.user = undefined;

      const middleware = requireSuperuser();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});

