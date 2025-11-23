/**
 * Stripe Webhook Handler
 * Handles Stripe webhook events with signature verification and idempotency
 * Phase 8.1 - Billing & Stripe Integration
 */

import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import Stripe from 'stripe';
import type { PoolClient } from 'pg';
import { getPool } from '../../db/connection';
import {
  handleStripeInvoice,
  handleStripePaymentIntent
} from '../../services/billing/stripeService';
import { createAuditLog } from '../../services/audit/enhancedAuditService';
import { getErrorMessage } from '../../utils/errorUtils';

const router = Router();

// Use raw body parser for Stripe webhook signature verification
router.use(express.raw({ type: 'application/json' }));

/**
 * Verify Stripe webhook signature
 */
function verifyStripeSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required. Please set it in your .env file.');
  }
  try {
    return Stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    throw new Error(`Webhook signature verification failed: ${getErrorMessage(error)}`);
  }
}

/**
 * Check if event has already been processed (idempotency)
 */
async function isEventProcessed(
  client: PoolClient,
  eventId: string
): Promise<boolean> {
  const result = await client.query(
    'SELECT id FROM shared.external_events WHERE provider = $1 AND provider_event_id = $2 AND processed_at IS NOT NULL',
    ['stripe', eventId]
  );
  return result.rows.length > 0;
}

/**
 * Mark event as processed
 */
async function markEventProcessed(
  client: PoolClient,
  eventId: string,
  eventType: string,
  payload: unknown
): Promise<void> {
  await client.query(
    `INSERT INTO shared.external_events (provider, provider_event_id, event_type, payload, processed_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (provider, provider_event_id) 
     DO UPDATE SET processed_at = NOW()`,
    ['stripe', eventId, eventType, JSON.stringify(payload)]
  );
}

/**
 * Stripe webhook endpoint
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const signature = req.headers['stripe-signature'] as string;

  if (!signature) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    // Verify signature
    const event = verifyStripeSignature(req.body, signature);

    // Check idempotency
    if (await isEventProcessed(client, event.id)) {
      console.log(`[Stripe Webhook] Event ${event.id} already processed, skipping`);
      return res.json({ received: true, message: 'Event already processed' });
    }

    // Process event based on type
    switch (event.type) {
      case 'invoice.paid':
        await handleStripeInvoice(client, event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(client, event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(client, event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(client, event.data.object as Stripe.Subscription);
        break;

      case 'payment_intent.succeeded':
        await handleStripePaymentIntent(client, event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(client, event.data.object as Stripe.PaymentIntent);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(client, event.data.object as Stripe.Charge);
        break;

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    // Mark event as processed
    await markEventProcessed(client, event.id, event.type, event.data);

    res.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Error processing webhook:', error);
    next(error);
  } finally {
    client.release();
  }
});

/**
 * Handle invoice payment failed
 */
async function handleInvoicePaymentFailed(
  client: PoolClient,
  invoice: Stripe.Invoice
): Promise<void> {
  const tenantId = invoice.metadata?.tenant_id as string | undefined;
  if (!tenantId) {
    throw new Error('Invoice missing tenant_id in metadata');
  }

  // Update invoice status
  await client.query(
    'UPDATE shared.invoices SET status = $1, updated_at = NOW() WHERE stripe_invoice_id = $2',
    ['open', invoice.id]
  );

  // Audit log
  await createAuditLog(client, {
    tenantId,
    action: 'PAYMENT_FAILED',
    resourceType: 'invoice',
    resourceId: invoice.id,
    details: { invoiceId: invoice.id, attemptCount: invoice.attempt_count },
    severity: 'warning'
  });

  // TODO: Send notification to tenant admins
}

/**
 * Handle subscription updated
 */
async function handleSubscriptionUpdated(
  client: PoolClient,
  subscription: Stripe.Subscription
): Promise<void> {
  const tenantId = subscription.metadata?.tenant_id as string | undefined;
  if (!tenantId) {
    throw new Error('Subscription missing tenant_id in metadata');
  }

  // Update subscription in database
  await client.query(
    `UPDATE shared.subscriptions SET
      status = $1,
      current_period_start = $2,
      current_period_end = $3,
      trial_end = $4,
      cancel_at_period_end = $5,
      updated_at = NOW()
    WHERE stripe_subscription_id = $6`,
    [
      subscription.status,
      new Date((subscription as unknown as { current_period_start: number }).current_period_start * 1000),
      new Date((subscription as unknown as { current_period_end: number }).current_period_end * 1000),
      subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      subscription.cancel_at_period_end,
      subscription.id
    ]
  );

  // Audit log
  await createAuditLog(client, {
    tenantId,
    action: 'SUBSCRIPTION_UPDATED',
    resourceType: 'subscription',
    resourceId: subscription.id,
    details: { subscriptionId: subscription.id, status: subscription.status },
    severity: 'info'
  });
}

/**
 * Handle subscription deleted
 */
async function handleSubscriptionDeleted(
  client: PoolClient,
  subscription: Stripe.Subscription
): Promise<void> {
  const tenantId = subscription.metadata?.tenant_id as string | undefined;
  if (!tenantId) {
    throw new Error('Subscription missing tenant_id in metadata');
  }

  // Update subscription status
  await client.query(
    `UPDATE shared.subscriptions SET
      status = 'canceled',
      canceled_at = NOW(),
      updated_at = NOW()
    WHERE stripe_subscription_id = $1`,
    [subscription.id]
  );

  // Audit log
  await createAuditLog(client, {
    tenantId,
    action: 'SUBSCRIPTION_CANCELED',
    resourceType: 'subscription',
    resourceId: subscription.id,
    details: { subscriptionId: subscription.id },
    severity: 'info'
  });
}

/**
 * Handle payment intent failed
 */
async function handlePaymentIntentFailed(
  client: PoolClient,
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const tenantId = paymentIntent.metadata?.tenant_id as string | undefined;
  if (!tenantId) {
    throw new Error('PaymentIntent missing tenant_id in metadata');
  }

  // Update payment status
  await client.query(
    `UPDATE shared.payments SET
      status = 'failed',
      failure_reason = $1,
      updated_at = NOW()
    WHERE stripe_payment_intent_id = $2`,
    [paymentIntent.last_payment_error?.message || 'Payment failed', paymentIntent.id]
  );

  // Audit log
  await createAuditLog(client, {
    tenantId,
    action: 'PAYMENT_FAILED',
    resourceType: 'payment',
    resourceId: paymentIntent.id,
    details: {
      paymentIntentId: paymentIntent.id,
      error: paymentIntent.last_payment_error?.message
    },
    severity: 'warning'
  });
}

/**
 * Handle charge refunded
 */
async function handleChargeRefunded(
  client: PoolClient,
  charge: Stripe.Charge
): Promise<void> {
  // Update payment status
  await client.query(
    `UPDATE shared.payments SET
      status = 'refunded',
      updated_at = NOW()
    WHERE stripe_charge_id = $1`,
    [charge.id]
  );

  // Audit log
  const tenantId = charge.metadata?.tenant_id as string | undefined;
  if (tenantId) {
    await createAuditLog(client, {
      tenantId,
      action: 'PAYMENT_REFUNDED',
      resourceType: 'payment',
      resourceId: charge.id,
      details: { chargeId: charge.id, amount: charge.amount_refunded },
      severity: 'info'
    });
  }
}

export default router;

