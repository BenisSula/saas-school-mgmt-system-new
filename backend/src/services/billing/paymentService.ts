import crypto from 'crypto';
import type { PoolClient } from 'pg';
import {
  getPaymentProvider,
  type PaymentIntentRequest,
  type PaymentIntentResponse,
} from '../payments/provider';
import { markInvoiceAsPaid, updateInvoiceStatus } from './invoiceService';
// getSubscriptionById not used in this file but may be needed for future implementations

export interface RecordPaymentInput {
  invoiceId: string;
  tenantId: string;
  amount: number;
  currency?: string;
  provider: string;
  providerPaymentId: string;
  paymentMethod?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create payment intent for an invoice
 */
export async function createPaymentIntent(
  client: PoolClient,
  invoiceId: string,
  tenantId: string
): Promise<PaymentIntentResponse> {
  // Get invoice
  const invoiceResult = await client.query(
    'SELECT * FROM shared.invoices WHERE id = $1 AND tenant_id = $2',
    [invoiceId, tenantId]
  );

  if (invoiceResult.rowCount === 0) {
    throw new Error('Invoice not found');
  }

  const invoice = invoiceResult.rows[0];

  if (invoice.status === 'paid') {
    throw new Error('Invoice is already paid');
  }

  if (invoice.status === 'void') {
    throw new Error('Invoice is void');
  }

  // Create payment intent via provider
  const provider = getPaymentProvider();
  const paymentRequest: PaymentIntentRequest = {
    amount: Number(invoice.amount),
    currency: invoice.currency || 'USD',
    invoiceId,
    metadata: {
      tenantId,
      invoiceNumber: invoice.invoice_number,
    },
  };

  return await provider.createPaymentIntent(paymentRequest);
}

/**
 * Record a payment (from webhook or manual entry)
 */
export async function recordPlatformPayment(
  client: PoolClient,
  input: RecordPaymentInput
): Promise<unknown> {
  const paymentId = crypto.randomUUID();

  await client.query('BEGIN');
  try {
    // Verify invoice exists and belongs to tenant
    const invoiceResult = await client.query(
      'SELECT * FROM shared.invoices WHERE id = $1 AND tenant_id = $2',
      [input.invoiceId, input.tenantId]
    );

    if (invoiceResult.rowCount === 0) {
      throw new Error('Invoice not found');
    }

    // Invoice data is accessed directly from query result, no need to store in variable
    // const invoice = invoiceResult.rows[0];

    // Create payment record
    const paymentResult = await client.query(
      `
        INSERT INTO shared.payments (
          id, invoice_id, tenant_id, amount, currency,
          provider, provider_payment_id, payment_method, status, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)
        RETURNING *
      `,
      [
        paymentId,
        input.invoiceId,
        input.tenantId,
        input.amount,
        input.currency || 'USD',
        input.provider,
        input.providerPaymentId,
        input.paymentMethod || null,
        JSON.stringify(input.metadata || {}),
      ]
    );

    await client.query('COMMIT');
    return paymentResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/**
 * Update payment status (from webhook)
 */
export async function updatePaymentStatus(
  client: PoolClient,
  provider: string,
  providerPaymentId: string,
  status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'canceled',
  failureReason?: string
): Promise<unknown> {
  await client.query('BEGIN');
  try {
    // Find payment
    const paymentResult = await client.query(
      `
        SELECT * FROM shared.payments
        WHERE provider = $1 AND provider_payment_id = $2
      `,
      [provider, providerPaymentId]
    );

    if (paymentResult.rowCount === 0) {
      throw new Error('Payment not found');
    }

    const payment = paymentResult.rows[0];

    // Update payment
    const updateResult = await client.query(
      `
        UPDATE shared.payments
        SET status = $1,
            failure_reason = $2,
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `,
      [status, failureReason || null, payment.id]
    );

    // If payment succeeded, mark invoice as paid
    if (status === 'succeeded' && payment.invoice_id) {
      await markInvoiceAsPaid(client, payment.invoice_id, payment.id);
    }

    // If payment failed and invoice exists, update invoice status if needed
    if (status === 'failed' && payment.invoice_id) {
      // Check if invoice should be marked as uncollectible after multiple failures
      const failureCountResult = await client.query(
        `
          SELECT COUNT(*) as count
          FROM shared.payments
          WHERE invoice_id = $1 AND status = 'failed'
        `,
        [payment.invoice_id]
      );
      const failureCount = parseInt(failureCountResult.rows[0].count, 10);

      if (failureCount >= 3) {
        await updateInvoiceStatus(client, payment.invoice_id, 'uncollectible');
      }
    }

    await client.query('COMMIT');
    return updateResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/**
 * Get payment history for a tenant
 */
export async function getPaymentHistory(
  client: PoolClient,
  tenantId: string,
  filters?: {
    invoiceId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ payments: unknown[]; total: number }> {
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;
  const conditions: string[] = ['tenant_id = $1'];
  const values: unknown[] = [tenantId];
  let paramIndex = 2;

  if (filters?.invoiceId) {
    conditions.push(`invoice_id = $${paramIndex++}`);
    values.push(filters.invoiceId);
  }

  if (filters?.status) {
    conditions.push(`status = $${paramIndex++}`);
    values.push(filters.status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await client.query(
    `SELECT COUNT(*) as total FROM shared.payments ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get payments
  values.push(limit, offset);
  const paymentsResult = await client.query(
    `
      SELECT * FROM shared.payments
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `,
    values
  );

  return {
    payments: paymentsResult.rows,
    total,
  };
}

/**
 * Process dunning (retry failed payments)
 */
export async function processDunning(
  client: PoolClient,
  invoiceId: string,
  attemptNumber: number
): Promise<unknown> {
  await client.query('BEGIN');
  try {
    // Get invoice
    const invoiceResult = await client.query('SELECT * FROM shared.invoices WHERE id = $1', [
      invoiceId,
    ]);

    if (invoiceResult.rowCount === 0) {
      throw new Error('Invoice not found');
    }

    const invoice = invoiceResult.rows[0];

    if (invoice.status === 'paid') {
      throw new Error('Invoice is already paid');
    }

    // Create dunning attempt record
    const dunningId = crypto.randomUUID();
    const scheduledAt = new Date();

    await client.query(
      `
        INSERT INTO shared.dunning_attempts (
          id, invoice_id, tenant_id, attempt_number,
          status, scheduled_at
        )
        VALUES ($1, $2, $3, $4, 'pending', $5)
      `,
      [dunningId, invoiceId, invoice.tenant_id, attemptNumber, scheduledAt]
    );

    // TODO: Integrate with payment provider to retry payment
    // For now, mark as attempted
    await client.query(
      `
        UPDATE shared.dunning_attempts
        SET status = 'attempted',
            attempted_at = NOW()
        WHERE id = $1
      `,
      [dunningId]
    );

    await client.query('COMMIT');
    return { id: dunningId, status: 'attempted' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
