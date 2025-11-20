import { Router } from 'express';
import ssoRouter from './auth/sso';
import rateLimit from 'express-rate-limit';
import authenticate from '../middleware/authenticate';
import { suspiciousLoginLimiter } from '../middleware/rateLimiter';
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
import {
  findTenantByRegistrationCode,
  findTenantByName,
  lookupTenant,
  listActiveTenants,
  getRecentSchools
} from '../services/tenantLookupService';

type ErrorWithCode = Error & { code?: string };

const isErrorWithCode = (error: unknown): error is ErrorWithCode =>
  error instanceof Error && typeof (error as { code?: unknown }).code === 'string';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

router.use(authLimiter);

// Health check endpoint for auth routes (checks database connection)
router.get('/health', async (_req, res) => {
  try {
    const { getPool } = await import('../db/connection');
    const pool = getPool();
    
    // Simple health check query with timeout
    const result = await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout')), 5000)
      )
    ]) as { rows: unknown[] };
    
    if (result && result.rows) {
      res.status(200).json({
        status: 'ok',
        db: 'ok',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'error',
        db: 'error',
        message: 'Database query returned unexpected result',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Auth Health] Error:', errorMessage);
    res.status(503).json({
      status: 'error',
      db: 'error',
      message: 'Database connection failed',
      error: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/signup', async (req, res) => {
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
            'MISSING_REQUIRED_FIELDS'
          )
        );
    }

    const response = await signUp({ email, password, role, tenantId, tenantName, profile });
    return res.status(201).json(response);
  } catch (error) {
    // Handle ValidationError (422 Unprocessable Entity)
    if (error instanceof ValidationError) {
      return res.status(422).json(createErrorResponse(error.message, error.field, error.code));
    }

    // Handle duplicate email (409 Conflict)
    if (isErrorWithCode(error) && error.code === 'DUPLICATE_EMAIL') {
      return res.status(409).json(createErrorResponse(error.message, 'email', 'DUPLICATE_EMAIL'));
    }

    // Handle known errors with appropriate status codes
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('tenant not found')) {
        return res
          .status(404)
          .json(createErrorResponse(error.message, 'tenantId', 'TENANT_NOT_FOUND'));
      }
      if (message.includes('validation') || message.includes('invalid')) {
        return res
          .status(422)
          .json(createErrorResponse(error.message, undefined, 'VALIDATION_ERROR'));
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
          'INTERNAL_ERROR'
        )
      );
  }
});

router.post('/login', suspiciousLoginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(422)
        .json(
          createErrorResponse(
            'email and password are required',
            undefined,
            'MISSING_REQUIRED_FIELDS'
          )
        );
    }

    const response = await login(
      { email, password },
      { ip: req.ip, userAgent: req.get('user-agent') ?? null }
    );
    
    // Track successful login attempt
    try {
      const { metrics } = await import('../middleware/metrics');
      metrics.incrementAuthAttempt('password', true, req.ip);
    } catch (metricsError) {
      // Don't fail the request if metrics fail
      console.error('[auth] Failed to track login metrics:', metricsError);
    }
    
    return res.status(200).json(response);
  } catch (error) {
    // Log full error for debugging
    const errorObj = error instanceof Error ? error : new Error(String(error));
    console.error('[auth] Login route error:', {
      message: errorObj.message,
      stack: errorObj.stack,
      name: errorObj.name
    });

    const errorMessage = errorObj.message;

    // Log failed login attempt
    try {
      const { logLoginAttempt } = await import('../services/superuser/platformAuditService');
      const { getPool } = await import('../db/connection');
      const pool = getPool();
      await logLoginAttempt(pool, {
        email: req.body.email || 'unknown',
        success: false,
        ipAddress: req.ip || null,
        userAgent: req.get('user-agent') || null,
        userId: null,
        tenantId: null,
        failureReason: errorMessage
      });
      
      // Track failed login attempt metrics
      const { metrics } = await import('../middleware/metrics');
      metrics.incrementAuthAttempt('password', false, req.ip || undefined);
    } catch (logError) {
      // Don't fail the request if logging fails
      console.error('[auth] Failed to log login attempt:', logError);
    }

    // Return 401 for authentication errors
    if (errorMessage.includes('Invalid credentials') || errorMessage.includes('not found')) {
      return res
        .status(401)
        .json(createErrorResponse('Invalid credentials', 'password', 'INVALID_CREDENTIALS'));
    }

    // Return 500 for unexpected errors
    return res
      .status(500)
      .json(
        createErrorResponse(
          'An unexpected error occurred during login',
          undefined,
          'INTERNAL_ERROR'
        )
      );
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'refreshToken is required' });
    }

    const response = await refreshToken(token, {
      ip: req.ip,
      userAgent: req.get('user-agent') ?? null
    });
    return res.status(200).json(response);
  } catch (error) {
    return res.status(401).json({ message: (error as Error).message });
  }
});

router.post('/request-password-reset', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'email is required' });
    }

    await requestPasswordReset(email);
    return res.status(200).json({ message: 'If the email exists, a reset link has been sent.' });
  } catch (error) {
    return res.status(500).json({ message: (error as Error).message });
  }
});

router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(422).json(
        createErrorResponse('currentPassword and newPassword are required', undefined, 'MISSING_REQUIRED_FIELDS')
      );
    }

    const { changeOwnPassword } = await import('../services/userPasswordService');
    const { extractIpAddress, extractUserAgent } = await import('../lib/superuserHelpers');

    await changeOwnPassword(
      getPool(),
      req.user!.id,
      currentPassword,
      newPassword,
      extractIpAddress(req),
      extractUserAgent(req)
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    const statusCode = errorMessage.includes('not found') || errorMessage.includes('incorrect') ? 400 : 500;
    res.status(statusCode).json(createErrorResponse(errorMessage));
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'token and password are required' });
    }

    await resetPassword(token, password);
    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
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
      return res.status(400).json({ message: 'refreshToken is required' });
    }
    await logout(req.user!.id, token, {
      ip: req.ip,
      userAgent: req.get('user-agent') ?? null
    });
    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
});

// SSO routes
router.use('/sso', ssoRouter);

export default router;
