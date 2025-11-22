import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import authorizeSuperUser from '../../middleware/authorizeSuperUser';
import { getPool } from '../../db/connection';
import {
  getLoginHistory,
  getActiveSessions,
  getPlatformActiveSessions,
  revokeAllUserSessions,
  endSession
} from '../../services/superuser/sessionService';
import {
  loginHistoryQuerySchema,
  revokeSessionParamsSchema,
  revokeAllSessionsParamsSchema,
  revokeAllSessionsBodySchema
} from '../../validators/superuserSessionValidator';
import { Role } from '../../config/permissions';

const router = Router();

// All routes require authentication and superuser authorization
router.use(authenticate, authorizeSuperUser);

/**
 * GET /superuser/sessions
 * Get platform-wide active sessions (superuser only)
 */
router.get('/sessions', async (req, res, next) => {
  try {
    const pool = getPool();
    
    const filters: {
      userId?: string;
      tenantId?: string | null;
      limit?: number;
      offset?: number;
    } = {};

    // Parse query parameters
    if (req.query.userId && typeof req.query.userId === 'string') {
      filters.userId = req.query.userId;
    }
    if (req.query.tenantId !== undefined) {
      filters.tenantId = req.query.tenantId === 'null' || req.query.tenantId === '' ? null : req.query.tenantId as string;
    }
    if (req.query.limit) {
      filters.limit = parseInt(req.query.limit as string, 10);
    }
    if (req.query.offset) {
      filters.offset = parseInt(req.query.offset as string, 10);
    }

    const result = await getPlatformActiveSessions(
      pool,
      filters,
      req.user!.role as Role
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /superuser/users/:userId/login-history
 * Get login history for a user
 */
router.get('/users/:userId/login-history', async (req, res, next) => {
  try {
    const pool = getPool();
    const { userId } = req.params;
    
    // Validate userId is UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Parse query parameters
    const queryResult = loginHistoryQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({ message: queryResult.error.message });
    }

    const filters = {
      userId,
      tenantId: queryResult.data.tenantId,
      startDate: queryResult.data.startDate,
      endDate: queryResult.data.endDate,
      isActive: queryResult.data.isActive,
      limit: queryResult.data.limit,
      offset: queryResult.data.offset
    };

    const result = await getLoginHistory(
      pool,
      filters,
      req.user!.role as Role,
      req.user!.id
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /superuser/users/:userId/sessions
 * Get active sessions for a user
 */
router.get('/users/:userId/sessions', async (req, res, next) => {
  try {
    const pool = getPool();
    const { userId } = req.params;
    
    // Validate userId is UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const sessions = await getActiveSessions(
      pool,
      userId,
      req.user!.role as Role,
      req.user!.id
    );

    res.json({ sessions });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /superuser/users/:userId/sessions/:sessionId/revoke
 * Revoke a specific session
 */
router.post('/users/:userId/sessions/:sessionId/revoke', async (req, res, next) => {
  try {
    const pool = getPool();
    const paramsResult = revokeSessionParamsSchema.safeParse(req.params);
    
    if (!paramsResult.success) {
      return res.status(400).json({ message: 'Invalid parameters' });
    }

    const { sessionId } = paramsResult.data;

    await endSession(pool, sessionId);

    res.json({ message: 'Session revoked successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /superuser/users/:userId/sessions/revoke-all
 * Revoke all sessions for a user
 */
router.post('/users/:userId/sessions/revoke-all', async (req, res, next) => {
  try {
    const pool = getPool();
    const paramsResult = revokeAllSessionsParamsSchema.safeParse(req.params);
    
    if (!paramsResult.success) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const bodyResult = revokeAllSessionsBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({ message: bodyResult.error.message });
    }

    const { userId } = paramsResult.data;
    const { exceptSessionId } = bodyResult.data;

    const revokedCount = await revokeAllUserSessions(
      pool,
      userId,
      req.user!.role as Role,
      req.user!.id,
      exceptSessionId
    );

    res.json({ 
      message: 'Sessions revoked successfully',
      revokedCount 
    });
  } catch (error) {
    next(error);
  }
});

export default router;

