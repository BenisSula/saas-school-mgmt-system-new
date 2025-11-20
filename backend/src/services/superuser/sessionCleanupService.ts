import { Pool } from 'pg';
import { getPool } from '../../db/connection';
import { autoExpireStaleSessions } from './sessionService';
import { logger } from '../../lib/logger';

/**
 * Session Cleanup Service
 * Handles periodic cleanup of expired sessions
 */

let cleanupInterval: NodeJS.Timeout | null = null;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Start the session cleanup job
 * Runs every hour to expire stale sessions
 */
export function startSessionCleanupJob(): void {
  if (cleanupInterval) {
    logger.warn('[sessionCleanupService] Cleanup job already running');
    return;
  }

  logger.info('[sessionCleanupService] Starting session cleanup job');

  // Run immediately on start
  runCleanup();

  // Then run every hour
  cleanupInterval = setInterval(() => {
    runCleanup();
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Stop the session cleanup job
 */
export function stopSessionCleanupJob(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info('[sessionCleanupService] Stopped session cleanup job');
  }
}

/**
 * Run the cleanup process
 */
async function runCleanup(): Promise<void> {
  try {
    const pool = getPool();
    const expiredCount = await autoExpireStaleSessions(pool);
    
    if (expiredCount > 0) {
      logger.info(`[sessionCleanupService] Expired ${expiredCount} stale sessions`);
    }
  } catch (error) {
    logger.error({ err: error }, '[sessionCleanupService] Error during session cleanup');
  }
}

