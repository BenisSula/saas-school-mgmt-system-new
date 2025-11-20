import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import authenticate from '../middleware/authenticate';
import {
  login,
  refreshToken,
  requestEmailVerification,
  requestPasswordReset,
  resetPassword,
  signUp,
  verifyEmail,
  logout
} from '../services/authService';
import { ValidationError } from '../middleware/validation';
import { createErrorResponse } from '../lib/apiErrors';
import { AuthError, AuthErrorCode } from '../lib/authErrorCodes';
import {
  findTenantByRegistrationCode,
  findTenantByName,
  lookupTenant,
  listActiveTenants,
  getRecentSchools
} from '../services/tenantLookupService';

const router = Router();

// Enhanced rate limiters for auth routes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: 'Too many login attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  keyGenerator: (req) => {
    // Use email if available, otherwise use IP helper for IPv6 safety
    if (req.body?.email) {
      return `login:${req.body.email}`;
    }
    // Use ipKeyGenerator helper for IPv6 compatibility
    // ipKeyGenerator returns a string, so we need to call it properly
    const ip = ipKeyGenerator(req as any);
    return `ip:${ip}`;
  }
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 signups per hour per IP
  message: 'Too many registration attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password reset requests per hour
  message: 'Too many password reset requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 refresh attempts per 15 minutes (allows normal usage)
  message: 'Too many token refresh attempts. Please sign in again.',
  standardHeaders: true,
  legacyHeaders: false
});

// Apply general auth limiter to all routes
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  standardHeaders: true,
  legacyHeaders: false
});

router.use(authLimiter);

// Health check endpoint for auth routes (checks database connection)
router.get('/health', async (_req, res) => {
  try {
    const { getPool } = await import('../db/connection');
    const pool = getPool();
    await pool.query('SELECT 1');
    res.status(200).json({
      status: 'ok',
      db: 'ok',
      timestamp: new Date().toISOString()
    });
  } catch {
    res.status(503).json({
      status: 'error',
      db: 'error',
      message: 'Database connection failed',
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/signup', signupLimiter, async (req, res) => {
  try {
    const { email, password, role, tenantId, tenantName, profile } = req.body;

    // Basic required field check
    if (!email || !password || !role) {
      return res
        .status(422)
        .json(
          createErrorResponse(
            'email, password, and role are required',
            undefined,
            AuthErrorCode.MISSING_REQUIRED_FIELDS
          )
        );
    }

    const response = await signUp({ email, password, role, tenantId, tenantName, profile });
    return res.status(201).json(response);
  } catch (error) {
    // Handle AuthError with standardized codes
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json(
        createErrorResponse(error.message, error.field, error.code)
      );
    }

    // Handle ValidationError (422 Unprocessable Entity)
    if (error instanceof ValidationError) {
      return res.status(422).json(createErrorResponse(error.message, error.field, error.code));
    }

    // Handle known errors with appropriate status codes
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('tenant not found')) {
        return res
          .status(404)
          .json(createErrorResponse(error.message, 'tenantId', AuthErrorCode.TENANT_NOT_FOUND));
      }
      if (message.includes('validation') || message.includes('invalid')) {
        return res
          .status(422)
          .json(createErrorResponse(error.message, undefined, AuthErrorCode.VALIDATION_ERROR));
      }
    }

    // Unknown errors (500 Internal Server Error)
    console.error('[auth] Signup error:', error);
    return res
      .status(500)
      .json(
        createErrorResponse(
          'An unexpected error occurred during registration',
          undefined,
          AuthErrorCode.INTERNAL_ERROR
        )
      );
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(422)
        .json(
          createErrorResponse(
            'email and password are required',
            undefined,
            AuthErrorCode.MISSING_REQUIRED_FIELDS
          )
        );
    }

    const response = await login(
      { email, password },
      { ip: req.ip, userAgent: req.get('user-agent') ?? null }
    );
    return res.status(200).json(response);
  } catch (error) {
    // Handle AuthError with standardized codes
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json(
        createErrorResponse(error.message, error.field, error.code)
      );
    }

    // Log full error for debugging
    const errorObj = error instanceof Error ? error : new Error(String(error));
    console.error('[auth] Login route error:', {
      message: errorObj.message,
      stack: errorObj.stack,
      name: errorObj.name
    });

    // Return 500 for unexpected errors
    return res
      .status(500)
      .json(
        createErrorResponse(
          'An unexpected error occurred during login',
          undefined,
          AuthErrorCode.INTERNAL_ERROR
        )
      );
  }
});

router.post('/refresh', refreshLimiter, async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json(
        createErrorResponse('refreshToken is required', undefined, AuthErrorCode.MISSING_REQUIRED_FIELDS)
      );
    }

    const response = await refreshToken(token, {
      ip: req.ip,
      userAgent: req.get('user-agent') ?? null
    });
    return res.status(200).json(response);
  } catch (error) {
    // Handle AuthError with standardized codes
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json(
        createErrorResponse(error.message, error.field, error.code)
      );
    }

    return res.status(401).json(
      createErrorResponse(
        (error as Error).message || 'Invalid refresh token',
        undefined,
        AuthErrorCode.REFRESH_TOKEN_INVALID
      )
    );
  }
});

router.post('/request-password-reset', passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json(
        createErrorResponse('email is required', 'email', AuthErrorCode.MISSING_REQUIRED_FIELDS)
      );
    }

    await requestPasswordReset(email);
    return res.status(200).json({ message: 'If the email exists, a reset link has been sent.' });
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json(
        createErrorResponse(error.message, error.field, error.code)
      );
    }
    return res.status(500).json(
      createErrorResponse(
        (error as Error).message || 'Failed to process password reset request',
        undefined,
        AuthErrorCode.INTERNAL_ERROR
      )
    );
  }
});

router.post('/reset-password', passwordResetLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json(
        createErrorResponse(
          'token and password are required',
          undefined,
          AuthErrorCode.MISSING_REQUIRED_FIELDS
        )
      );
    }

    await resetPassword(token, password);
    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json(
        createErrorResponse(error.message, error.field, error.code)
      );
    }
    return res.status(400).json(
      createErrorResponse(
        (error as Error).message || 'Failed to reset password',
        undefined,
        AuthErrorCode.VALIDATION_ERROR
      )
    );
  }
});

router.post('/request-email-verification', async (req, res) => {
  try {
    const { userId, email } = req.body;

    if (!userId || !email) {
      return res.status(400).json({ message: 'userId and email are required' });
    }

    await requestEmailVerification(userId, email);
    return res.status(200).json({ message: 'Verification email queued' });
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
});

router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'token is required' });
    }

    await verifyEmail(token);
    return res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
});

// Public endpoint: Get list of schools for dropdown/autocomplete
// Returns recently added schools and supports pagination
router.get('/list-schools', async (req, res) => {
  try {
    const { limit = '20', offset = '0', recent = 'true' } = req.query;

    const limitNum = Math.min(Number(limit) || 20, 100); // Cap at 100
    const offsetNum = Math.max(Number(offset) || 0, 0);

    if (recent === 'true') {
      // Return recently added schools (last 30 days)
      const recentSchools = await getRecentSchools(limitNum);
      return res.status(200).json({
        schools: recentSchools,
        count: recentSchools.length,
        type: 'recent'
      });
    } else {
      // Return paginated list of all active schools
      const result = await listActiveTenants(limitNum, offsetNum, false);
      return res.status(200).json({
        schools: result.tenants,
        count: result.tenants.length,
        total: result.total,
        type: 'all'
      });
    }
  } catch (error) {
    console.error('[auth] List schools error:', error);
    return res.status(500).json({ message: 'Failed to list schools' });
  }
});

// Public endpoint: Lookup tenant by registration code or name
// Used during registration to find the user's school
router.get('/lookup-tenant', async (req, res) => {
  try {
    const { code, name, domain, method = 'auto' } = req.query;

    if (!code && !name && !domain) {
      return res.status(400).json({
        message: 'Either code, name, or domain query parameter is required'
      });
    }

    let result;

    if (code && typeof code === 'string') {
      result = await findTenantByRegistrationCode(code);
      if (result) {
        return res.status(200).json(result);
      }
    }

    if (domain && typeof domain === 'string') {
      result = await lookupTenant(domain, 'domain');
      if (result && !Array.isArray(result)) {
        return res.status(200).json(result);
      }
    }

    if (name && typeof name === 'string') {
      const results = await findTenantByName(name, 10);
      if (results.length > 0) {
        return res.status(200).json({ results, count: results.length });
      }
    }

    // Try auto lookup if no specific method worked
    if (code || name || domain) {
      const identifier = (code || name || domain) as string;
      result = await lookupTenant(identifier, method as 'code' | 'domain' | 'name' | 'auto');
      if (result) {
        if (Array.isArray(result)) {
          return res.status(200).json({ results: result, count: result.length });
        }
        return res.status(200).json(result);
      }
    }

    return res.status(404).json({ message: 'Tenant not found' });
  } catch (error) {
    console.error('[auth] Tenant lookup error:', error);
    return res.status(500).json({ message: 'Failed to lookup tenant' });
  }
});

router.post('/logout', authenticate, async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return res.status(400).json(
        createErrorResponse('refreshToken is required', undefined, AuthErrorCode.MISSING_REQUIRED_FIELDS)
      );
    }
    await logout(req.user!.id, token, {
      ip: req.ip,
      userAgent: req.get('user-agent') ?? null
    });
    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json(
        createErrorResponse(error.message, error.field, error.code)
      );
    }
    return res.status(400).json(
      createErrorResponse(
        (error as Error).message || 'Failed to logout',
        undefined,
        AuthErrorCode.INTERNAL_ERROR
      )
    );
  }
});

export default router;
