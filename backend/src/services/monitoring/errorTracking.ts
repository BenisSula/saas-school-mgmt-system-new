/**
 * Error Tracking Service (Sentry Integration)
 * Centralized error tracking and reporting
 */

export interface ErrorContext {
  userId?: string;
  tenantId?: string;
  requestId?: string;
  userAgent?: string;
  ip?: string;
  url?: string;
  method?: string;
  [key: string]: unknown;
}

class ErrorTracker {
  private initialized = false;

  /**
   * Initialize error tracking (Sentry)
   */
  init(dsn?: string, environment?: string) {
    if (!dsn) {
      console.warn('[ErrorTracking] DSN not provided, error tracking disabled');
      return;
    }

    try {
      // In production, initialize Sentry here
      // import * as Sentry from '@sentry/node';
      // Sentry.init({ dsn, environment });
      this.initialized = true;
      console.log('[ErrorTracking] Initialized');
    } catch (error) {
      console.error('[ErrorTracking] Failed to initialize:', error);
    }
  }

  /**
   * Capture exception
   */
  captureException(error: Error, context?: ErrorContext) {
    if (!this.initialized) {
      console.error('[ErrorTracking] Error:', error.message, context);
      return;
    }

    try {
      // In production, use Sentry
      // Sentry.captureException(error, { contexts: { custom: context } });
      console.error('[ErrorTracking] Captured exception:', error.message, context);
    } catch (err) {
      console.error('[ErrorTracking] Failed to capture exception:', err);
    }
  }

  /**
   * Capture message
   */
  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext) {
    if (!this.initialized) {
      console.log(`[ErrorTracking] ${level}:`, message, context);
      return;
    }

    try {
      // In production, use Sentry
      // Sentry.captureMessage(message, level, { contexts: { custom: context } });
      console.log(`[ErrorTracking] Captured message [${level}]:`, message, context);
    } catch (err) {
      console.error('[ErrorTracking] Failed to capture message:', err);
    }
  }

  /**
   * Set user context
   */
  setUser(userId: string, email?: string, tenantId?: string) {
    if (!this.initialized) return;

    try {
      // In production, use Sentry
      // Sentry.setUser({ id: userId, email, tenantId });
    } catch (err) {
      console.error('[ErrorTracking] Failed to set user:', err);
    }
  }

  /**
   * Add breadcrumb
   */
  addBreadcrumb(message: string, category: string, level: 'info' | 'warning' | 'error' = 'info', data?: Record<string, unknown>) {
    if (!this.initialized) return;

    try {
      // In production, use Sentry
      // Sentry.addBreadcrumb({ message, category, level, data });
    } catch (err) {
      console.error('[ErrorTracking] Failed to add breadcrumb:', err);
    }
  }

  /**
   * Set context
   */
  setContext(name: string, context: Record<string, unknown>) {
    if (!this.initialized) return;

    try {
      // In production, use Sentry
      // Sentry.setContext(name, context);
    } catch (err) {
      console.error('[ErrorTracking] Failed to set context:', err);
    }
  }
}

export const errorTracker = new ErrorTracker();

/**
 * Initialize error tracking from environment
 */
export function initializeErrorTracking() {
  const dsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';
  errorTracker.init(dsn, environment);
}

