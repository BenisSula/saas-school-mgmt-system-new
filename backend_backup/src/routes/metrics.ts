/**
 * Prometheus Metrics Endpoint
 */

import { Router } from 'express';
import { getMetrics, getMetricsContentType } from '../middleware/metrics';

const router = Router();

// Prometheus metrics endpoint
router.get('/', async (_req, res) => {
  try {
    res.set('Content-Type', getMetricsContentType());
    res.end(await getMetrics());
  } catch {
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
});

export default router;

