/**
 * Stripe Integration Service
 * Handles Stripe customer, subscription, payment, and invoice operations
 * Phase 8.1 - Billing & Stripe Integration
 */

import Stripe from 'stripe';
import type { PoolClient } from 'pg';
import { createAuditLog } from '../audit/enhancedAuditService';

/**
 * Lazy initialization of Stripe client
 * Only initializes when actually needed, not at module load time
 */
let stripeInstance: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error(
        'STRIPE_SECRET_KEY environment variable is required. Please set it in your .env file.'
      );
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-11-17.clover',
      typescript: true,
    });
  }
  return stripeInstance;
}

/**
 * Get or create Stripe customer for a tenant
 */
export async function getOrCreateStripeCustomer(
  client: PoolClient,
  tenantId: string,
  tenantName: string,
  tenantEmail?: string
): Promise<string> {
  // Check if customer already exists in tenant metadata
  const tenantResult = await client.query<{ metadata: Record<string, unknown> }>(
    'SELECT metadata FROM shared.tenants WHERE id = $1',
    [tenantId]
  );

  if (tenantResult.rows.length === 0) {
    throw new Error('Tenant not found');
  }

  const metadata = tenantResult.rows[0].metadata || {};
  const existingCustomerId = metadata.stripe_customer_id as string | undefined;

  if (existingCustomerId) {
    // Verify customer still exists in Stripe
    try {
      await getStripeClient().customers.retrieve(existingCustomerId);
      return existingCustomerId;
    } catch {
      // Customer doesn't exist in Stripe, create new one
      console.warn(
        `[Stripe] Customer ${existingCustomerId} not found in Stripe, creating new customer`
      );
    }
  }

  // Create new Stripe customer
  const customer = await getStripeClient().customers.create({
    name: tenantName,
    email: tenantEmail,
    metadata: {
      tenant_id: tenantId,
    },
  });

  // Store customer ID in tenant metadata
  await client.query(
    "UPDATE shared.tenants SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('stripe_customer_id', $1) WHERE id = $2",
    [customer.id, tenantId]
  );

  // Audit log
  await createAuditLog(client, {
    tenantId,
    action: 'STRIPE_CUSTOMER_CREATED',
    resourceType: 'billing',
    resourceId: customer.id,
    details: { tenantId, customerId: customer.id },
    severity: 'info',
  });

  return customer.id;
}

/**
 * Create Stripe subscription for a tenant
 */
export async function createStripeSubscription(
  client: PoolClient,
  tenantId: string,
  priceId: string,
  options?: {
    trialDays?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<Stripe.Subscription> {
  const customerId = await getOrCreateStripeCustomer(
    client,
    tenantId,
    'Tenant', // Will be updated with actual tenant name
    undefined
  );

  const subscriptionParams: Stripe.SubscriptionCreateParams = {
    customer: customerId,
    items: [{ price: priceId }],
    metadata: {
      tenant_id: tenantId,
      ...options?.metadata,
    },
  };

  if (options?.trialDays) {
    subscriptionParams.trial_period_days = options.trialDays;
  }

  const subscription = await getStripeClient().subscriptions.create(subscriptionParams);

  // Store subscription in database
  await client.query(
    `INSERT INTO shared.subscriptions (
      tenant_id, stripe_subscription_id, stripe_customer_id, plan_id, status,
      current_period_start, current_period_end, trial_end, price_cents, currency,
      billing_interval, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (tenant_id, provider_subscription_id) 
    DO UPDATE SET
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      status = EXCLUDED.status,
      current_period_start = EXCLUDED.current_period_start,
      current_period_end = EXCLUDED.current_period_end,
      trial_end = EXCLUDED.trial_end,
      price_cents = EXCLUDED.price_cents,
      billing_interval = EXCLUDED.billing_interval,
      updated_at = NOW()`,
    [
      tenantId,
      subscription.id,
      customerId,
      priceId,
      subscription.status,
      new Date(
        (subscription as unknown as { current_period_start: number }).current_period_start * 1000
      ),
      new Date(
        (subscription as unknown as { current_period_end: number }).current_period_end * 1000
      ),
      subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      subscription.items.data[0]?.price.unit_amount || 0,
      subscription.currency.toUpperCase(),
      subscription.items.data[0]?.price.recurring?.interval || 'month',
      JSON.stringify(subscription.metadata),
    ]
  );

  // Audit log
  await createAuditLog(client, {
    tenantId,
    action: 'SUBSCRIPTION_CREATED',
    resourceType: 'subscription',
    resourceId: subscription.id,
    details: { tenantId, subscriptionId: subscription.id, priceId },
    severity: 'info',
  });

  return subscription;
}

/**
 * Update Stripe subscription (plan change, proration)
 */
export async function updateStripeSubscription(
  client: PoolClient,
  subscriptionId: string,
  newPriceId: string,
  prorate: boolean = true
): Promise<Stripe.Subscription> {
  // Get current subscription
  const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);

  // Update subscription with new price
  const updatedSubscription = await getStripeClient().subscriptions.update(subscriptionId, {
    items: [
      {
        id: subscription.items.data[0]?.id,
        price: newPriceId,
      },
    ],
    proration_behavior: prorate ? 'create_prorations' : 'none',
    metadata: {
      ...subscription.metadata,
      plan_changed_at: new Date().toISOString(),
    },
  });

  // Update database
  await client.query(
    `UPDATE shared.subscriptions SET
      plan_id = $1,
      price_cents = $2,
      status = $3,
      current_period_start = $4,
      current_period_end = $5,
      updated_at = NOW()
    WHERE stripe_subscription_id = $6`,
    [
      newPriceId,
      updatedSubscription.items.data[0]?.price.unit_amount || 0,
      updatedSubscription.status,
      new Date(
        (updatedSubscription as unknown as { current_period_start: number }).current_period_start *
          1000
      ),
      new Date(
        (updatedSubscription as unknown as { current_period_end: number }).current_period_end * 1000
      ),
      subscriptionId,
    ]
  );

  // Audit log
  const tenantId = subscription.metadata.tenant_id as string;
  await createAuditLog(client, {
    tenantId,
    action: 'SUBSCRIPTION_UPDATED',
    resourceType: 'subscription',
    resourceId: subscriptionId,
    details: { subscriptionId, newPriceId, prorate },
    severity: 'info',
  });

  return updatedSubscription;
}

/**
 * Cancel Stripe subscription
 */
export async function cancelStripeSubscription(
  client: PoolClient,
  subscriptionId: string,
  cancelImmediately: boolean = false
): Promise<Stripe.Subscription> {
  const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);

  const canceledSubscription = cancelImmediately
    ? await getStripeClient().subscriptions.cancel(subscriptionId)
    : await getStripeClient().subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });

  // Update database
  await client.query(
    `UPDATE shared.subscriptions SET
      status = $1,
      canceled_at = $2,
      cancel_at_period_end = $3,
      updated_at = NOW()
    WHERE stripe_subscription_id = $4`,
    [
      canceledSubscription.status,
      cancelImmediately ? new Date() : null,
      !cancelImmediately,
      subscriptionId,
    ]
  );

  // Audit log
  const tenantId = subscription.metadata.tenant_id as string;
  await createAuditLog(client, {
    tenantId,
    action: 'SUBSCRIPTION_CANCELED',
    resourceType: 'subscription',
    resourceId: subscriptionId,
    details: { subscriptionId, cancelImmediately },
    severity: 'info',
  });

  return canceledSubscription;
}

/**
 * Handle Stripe invoice payment
 */
export async function handleStripeInvoice(
  client: PoolClient,
  invoice: Stripe.Invoice
): Promise<void> {
  const tenantId = invoice.metadata?.tenant_id as string | undefined;
  if (!tenantId) {
    throw new Error('Invoice missing tenant_id in metadata');
  }

  // Store or update invoice
  await client.query(
    `INSERT INTO shared.invoices (
      tenant_id, stripe_invoice_id, invoice_number, amount_cents, currency,
      status, pdf_url, hosted_invoice_url, metadata, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    ON CONFLICT (provider_invoice_id) 
    DO UPDATE SET
      status = EXCLUDED.status,
      pdf_url = EXCLUDED.pdf_url,
      hosted_invoice_url = EXCLUDED.hosted_invoice_url,
      paid_at = CASE WHEN EXCLUDED.status = 'paid' THEN NOW() ELSE invoices.paid_at END,
      updated_at = NOW()`,
    [
      tenantId,
      invoice.id,
      invoice.number || `INV-${invoice.id.slice(-8)}`,
      invoice.amount_paid || invoice.amount_due,
      invoice.currency.toUpperCase(),
      invoice.status,
      invoice.invoice_pdf || null,
      invoice.hosted_invoice_url || null,
      JSON.stringify(invoice.metadata),
    ]
  );

  // If paid, record payment
  const paymentIntentId = (invoice as unknown as { payment_intent?: string | { id: string } })
    .payment_intent;
  if (invoice.status === 'paid' && paymentIntentId) {
    const paymentIntentIdStr =
      typeof paymentIntentId === 'string' ? paymentIntentId : paymentIntentId.id;
    const paymentIntent = await getStripeClient().paymentIntents.retrieve(paymentIntentIdStr);

    await client.query(
      `INSERT INTO shared.payments (
        tenant_id, stripe_payment_intent_id, stripe_charge_id, amount_cents, currency,
        status, provider, provider_payment_id, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (provider, provider_payment_id) DO NOTHING`,
      [
        tenantId,
        paymentIntent.id,
        typeof paymentIntent.latest_charge === 'string'
          ? paymentIntent.latest_charge
          : paymentIntent.latest_charge?.id || null,
        paymentIntent.amount,
        paymentIntent.currency.toUpperCase(),
        paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending',
        'stripe',
        paymentIntent.id,
        JSON.stringify(paymentIntent.metadata),
      ]
    );

    // Audit log
    await createAuditLog(client, {
      tenantId,
      action: 'PAYMENT_SUCCEEDED',
      resourceType: 'payment',
      resourceId: paymentIntent.id,
      details: {
        invoiceId: invoice.id,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      },
      severity: 'info',
    });
  }

  // Audit log for invoice
  await createAuditLog(client, {
    tenantId,
    action: 'INVOICE_GENERATED',
    resourceType: 'invoice',
    resourceId: invoice.id,
    details: { invoiceId: invoice.id, status: invoice.status },
    severity: 'info',
  });
}

/**
 * Handle Stripe payment intent
 */
export async function handleStripePaymentIntent(
  client: PoolClient,
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const tenantId = paymentIntent.metadata?.tenant_id as string | undefined;
  if (!tenantId) {
    throw new Error('PaymentIntent missing tenant_id in metadata');
  }

  const status =
    paymentIntent.status === 'succeeded'
      ? 'succeeded'
      : paymentIntent.status === 'canceled'
        ? 'canceled'
        : paymentIntent.status === 'processing'
          ? 'processing'
          : 'failed';

  await client.query(
    `INSERT INTO shared.payments (
      tenant_id, user_id, stripe_payment_intent_id, stripe_charge_id, amount_cents, currency,
      status, provider, provider_payment_id, payment_method, metadata, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    ON CONFLICT (provider, provider_payment_id) 
    DO UPDATE SET
      status = EXCLUDED.status,
      stripe_charge_id = EXCLUDED.stripe_charge_id,
      updated_at = NOW()`,
    [
      tenantId,
      (paymentIntent.metadata?.user_id as string | undefined) || null,
      paymentIntent.id,
      typeof paymentIntent.latest_charge === 'string'
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge?.id || null,
      paymentIntent.amount,
      paymentIntent.currency.toUpperCase(),
      status,
      'stripe',
      paymentIntent.id,
      paymentIntent.payment_method_types[0] || null,
      JSON.stringify(paymentIntent.metadata),
    ]
  );

  // Audit log
  const action =
    status === 'succeeded'
      ? 'PAYMENT_SUCCEEDED'
      : status === 'failed'
        ? 'PAYMENT_FAILED'
        : 'PAYMENT_PROCESSING';

  await createAuditLog(client, {
    tenantId,
    action,
    resourceType: 'payment',
    resourceId: paymentIntent.id,
    details: {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status,
    },
    severity: status === 'succeeded' ? 'info' : 'warning',
  });
}

/**
 * Get Stripe customer ID for tenant
 */
export async function getStripeCustomerId(
  client: PoolClient,
  tenantId: string
): Promise<string | null> {
  const result = await client.query<{ metadata: Record<string, unknown> }>(
    'SELECT metadata FROM shared.tenants WHERE id = $1',
    [tenantId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return (result.rows[0].metadata?.stripe_customer_id as string) || null;
}
