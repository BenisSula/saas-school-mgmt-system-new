/**
 * Incident Response Automation Service
 * Automatically creates incidents, notifies teams, and tracks resolution
 */

import { getPool } from '../../db/connection';
import { logger } from './loggingService';
import { errorTracker } from './errorTracking';
import { createIncident, addIncidentUpdate } from '../support/statusPageService';

export interface IncidentAlert {
  alertname: string;
  severity: 'critical' | 'warning' | 'info';
  component: string;
  summary: string;
  description: string;
  labels: Record<string, string>;
  startsAt: string;
  status?: 'firing' | 'resolved';
}

/**
 * Process alert and create incident if needed
 */
export async function processAlert(alert: IncidentAlert): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    // Only create incidents for critical alerts
    if (alert.severity !== 'critical') {
      logger.info('Alert processed (non-critical, no incident created)', {
        alertname: alert.alertname,
        severity: alert.severity,
      });
      return;
    }

    // Check if incident already exists for this alert
    const existingIncident = await client.query(
      `
        SELECT id FROM shared.status_incidents
        WHERE status != 'resolved'
          AND metadata->>'alertname' = $1
          AND started_at > NOW() - INTERVAL '1 hour'
        ORDER BY started_at DESC
        LIMIT 1
      `,
      [alert.alertname]
    );

    if ((existingIncident.rowCount ?? 0) > 0) {
      logger.info('Incident already exists for alert', {
        alertname: alert.alertname,
        incidentId: existingIncident.rows[0].id,
      });
      return;
    }

    // Create incident
    const incident = await createIncident(client, {
      title: `[${alert.severity.toUpperCase()}] ${alert.summary}`,
      description: `${alert.description}\n\nAlert: ${alert.alertname}\nLabels: ${JSON.stringify(alert.labels)}`,
      status: 'investigating',
      severity: alert.severity === 'critical' ? 'critical' : 'major',
      affectedServices: [alert.component],
    });

    logger.info('Incident created from alert', {
      alertname: alert.alertname,
      incidentId: (incident as { id: string }).id,
    });

    // Track in error tracking system
    errorTracker.captureMessage(`Incident created: ${alert.summary}`, 'error', {
      incidentId: (incident as { id: string }).id,
      alertname: alert.alertname,
      severity: alert.severity,
      component: alert.component,
    });

    // Send notification (integrate with notification service)
    // await sendIncidentNotification(incident);
  } catch (error) {
    logger.error('Failed to process alert', error as Error, {
      alertname: alert.alertname,
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Webhook handler for Alertmanager
 */
export async function handleAlertmanagerWebhook(payload: {
  alerts: IncidentAlert[];
}): Promise<void> {
  for (const alert of payload.alerts) {
    try {
      if (alert.status === 'firing') {
        await processAlert(alert);
      } else if (alert.status === 'resolved') {
        await resolveIncidentFromAlert(alert);
      }
    } catch (error) {
      logger.error('Failed to handle alert', error as Error, {
        alertname: alert.alertname,
      });
    }
  }
}

/**
 * Resolve incident when alert is resolved
 */
async function resolveIncidentFromAlert(alert: IncidentAlert): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `
        SELECT id FROM shared.status_incidents
        WHERE status != 'resolved'
          AND metadata->>'alertname' = $1
        ORDER BY started_at DESC
        LIMIT 1
      `,
      [alert.alertname]
    );

    if ((result.rowCount ?? 0) > 0) {
      const incidentId = result.rows[0].id;
      await addIncidentUpdate(client, {
        incidentId,
        status: 'resolved',
        message: `Alert resolved: ${alert.summary}`,
      });

      logger.info('Incident resolved from alert', {
        alertname: alert.alertname,
        incidentId,
      });
    }
  } catch (error) {
    logger.error('Failed to resolve incident from alert', error as Error);
  } finally {
    client.release();
  }
}
