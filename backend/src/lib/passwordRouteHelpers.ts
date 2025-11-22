/**
 * Password Route Helpers
 * Consolidates common password management route patterns
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { getPool } from '../db/connection';
import { extractIpAddress, extractUserAgent } from './superuserHelpers';
import { Role } from '../config/permissions';

export const resetPasswordParamsSchema = z.object({
  userId: z.string().uuid()
});

export const resetPasswordBodySchema = z.object({
  reason: z.string().optional()
});

export const changePasswordParamsSchema = z.object({
  userId: z.string().uuid()
});

export const changePasswordBodySchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  reason: z.string().optional()
});

/**
 * Common password reset handler
 */
export function createPasswordResetHandler(options: {
  resetPassword: (
    pool: any,
    userId: string,
    actorId: string,
    role: Role,
    ipAddress: string,
    userAgent: string,
    reason?: string
  ) => Promise<{ temporaryPassword: string }>;
}) {
  return async (req: Request, res: Response, next: any) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const pool = getPool();
      const paramsResult = resetPasswordParamsSchema.safeParse(req.params);
      
      if (!paramsResult.success) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }

      const bodyResult = resetPasswordBodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        return res.status(400).json({ message: bodyResult.error.message });
      }

      const { userId } = paramsResult.data;
      const { reason } = bodyResult.data;

      const ipAddress = extractIpAddress(req) || '';
      const userAgent = extractUserAgent(req) || '';

      const result = await options.resetPassword(
        pool,
        userId,
        req.user.id,
        req.user.role as Role,
        ipAddress,
        userAgent,
        reason
      );

      res.json({
        message: 'Password reset successfully',
        temporaryPassword: result.temporaryPassword
      });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Common password change handler
 */
export function createPasswordChangeHandler(options: {
  changePassword: (
    pool: any,
    userId: string,
    newPassword: string,
    actorId: string,
    role: Role,
    ipAddress: string,
    userAgent: string,
    reason?: string
  ) => Promise<void>;
}) {
  return async (req: Request, res: Response, next: any) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const pool = getPool();
      const paramsResult = changePasswordParamsSchema.safeParse(req.params);
      
      if (!paramsResult.success) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }

      const bodyResult = changePasswordBodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        return res.status(400).json({ message: bodyResult.error.message });
      }

      const { userId } = paramsResult.data;
      const { newPassword, reason } = bodyResult.data;

      const ipAddress = extractIpAddress(req) || '';
      const userAgent = extractUserAgent(req) || '';

      await options.changePassword(
        pool,
        userId,
        newPassword,
        req.user.id,
        req.user.role as Role,
        ipAddress,
        userAgent,
        reason
      );

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      next(error);
    }
  };
}

