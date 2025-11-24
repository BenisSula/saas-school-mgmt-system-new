/**
 * Enhanced Health Check Endpoints
 * Supports Kubernetes liveness/readiness probes and detailed health checks
 */

import { Router } from 'express';
import {
  getHealthStatus,
  getReadinessStatus,
  getLivenessStatus,
} from '../services/monitoring/healthService';

const router = Router();

// Basic health check (for load balancers)
router.get('/', async (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Detailed health check
router.get('/detailed', async (_req, res) => {
  try {
    const health = await getHealthStatus();
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Health check failed',
    });
  }
});

// Kubernetes readiness probe
router.get('/ready', async (_req, res) => {
  try {
    const readiness = await getReadinessStatus();
    const statusCode = readiness.ready ? 200 : 503;
    res.status(statusCode).json(readiness);
  } catch (error) {
    res.status(503).json({
      ready: false,
      error: error instanceof Error ? error.message : 'Readiness check failed',
    });
  }
});

// Kubernetes liveness probe
router.get('/live', (_req, res) => {
  const liveness = getLivenessStatus();
  res.json(liveness);
});

export default router;
