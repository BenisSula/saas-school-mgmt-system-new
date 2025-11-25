/**
 * Incident Response Webhook Endpoint
 * Receives alerts from Alertmanager and creates incidents
 */

import { Router } from 'express';
import { handleAlertmanagerWebhook } from '../services/monitoring/incidentResponse';

const router = Router();

// Webhook endpoint for Alertmanager
router.post('/webhook', async (req, res) => {
  try {
    await handleAlertmanagerWebhook(req.body);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[IncidentResponse] Webhook error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
