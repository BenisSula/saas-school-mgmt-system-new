/**
 * Prometheus Metrics Endpoint
 */

import { Router, type Request, type Response } from 'express';
import { getMetrics, getMetricsContentType } from '../middleware/metrics';

const router = Router();

// Prometheus metrics endpoint
router.get('/', async (_req: Request, res: Response) => {
  try {
    res.set('Content-Type', getMetricsContentType());
    res.end(await getMetrics());
  } catch {
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
});

// Frontend performance metrics endpoint
router.post('/frontend', async (req: Request, res: Response) => {
  try {
    const { metrics } = req.body;

    if (!Array.isArray(metrics)) {
      return res.status(400).json({ error: 'Invalid metrics format' });
    }

    // Log frontend metrics (can be extended to store in database or send to monitoring service)
    console.log('[Frontend Metrics]', JSON.stringify(metrics, null, 2));

    // TODO: Store metrics in database or send to monitoring service
    // For now, just acknowledge receipt

    res.json({ success: true, received: metrics.length });
  } catch (error) {
    console.error('[Frontend Metrics] Error:', error);
    res.status(500).json({ error: 'Failed to process metrics' });
  }
});

export default router;
