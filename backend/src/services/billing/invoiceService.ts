import crypto from 'crypto';
import type { PoolClient } from 'pg';
import { getSubscriptionById } from './subscriptionService';

export interface CreateInvoiceInput {
  subscriptionId?: string;
  tenantId: string;
  amount: number;
  currency?: string;
  dueDate?: Date;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface InvoiceLineItem {
  description: string;
  amount: number;
  quantity?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Generate invoice number (e.g., INV-2025-0001)
 */
function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const random = crypto.randomBytes(2).readUInt16BE(0);
  return `INV-${year}-${random.toString().padStart(4, '0')}`;
}

/**
 * Create a platform-level invoice (separate from tenant fee_invoices)
 */
export async function createPlatformInvoice(
  client: PoolClient,
  input: CreateInvoiceInput,
  lineItems?: InvoiceLineItem[]
): Promise<unknown> {
  const invoiceId = crypto.randomUUID();
  const invoiceNumber = generateInvoiceNumber();
  const currency = input.currency || 'USD';
  const amount = lineItems
    ? lineItems.reduce((sum, item) => sum + item.amount * (item.quantity || 1), 0)
    : input.amount;

  if (amount <= 0) {
    throw new Error('Invoice amount must be greater than 0');
  }

  await client.query('BEGIN');
  try {
    // If subscription ID provided, verify it exists and belongs to tenant
    if (input.subscriptionId) {
      const subscription = await getSubscriptionById(client, input.subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }
      // Verify tenant matches
      if ((subscription as { tenant_id: string }).tenant_id !== input.tenantId) {
        throw new Error('Subscription does not belong to tenant');
      }
    }

    // Create invoice
    const invoiceResult = await client.query(
      `
        INSERT INTO shared.invoices (
          id, subscription_id, tenant_id, invoice_number,
          amount, currency, status, due_date, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8)
        RETURNING *
      `,
      [
        invoiceId,
        input.subscriptionId || null,
        input.tenantId,
        invoiceNumber,
        amount,
        currency,
        input.dueDate || null,
        JSON.stringify({
          ...input.metadata,
          description: input.description,
          lineItems: lineItems || [],
        }),
      ]
    );

    await client.query('COMMIT');
    return invoiceResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/**
 * Get invoice by ID
 */
export async function getInvoiceById(
  client: PoolClient,
  invoiceId: string
): Promise<unknown | null> {
  const result = await client.query('SELECT * FROM shared.invoices WHERE id = $1', [invoiceId]);

  return result.rows[0] || null;
}

/**
 * Get invoices for a tenant
 */
export async function getInvoicesForTenant(
  client: PoolClient,
  tenantId: string,
  filters?: {
    status?: string;
    subscriptionId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ invoices: unknown[]; total: number }> {
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;
  const conditions: string[] = ['tenant_id = $1'];
  const values: unknown[] = [tenantId];
  let paramIndex = 2;

  if (filters?.status) {
    conditions.push(`status = $${paramIndex++}`);
    values.push(filters.status);
  }

  if (filters?.subscriptionId) {
    conditions.push(`subscription_id = $${paramIndex++}`);
    values.push(filters.subscriptionId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await client.query(
    `SELECT COUNT(*) as total FROM shared.invoices ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get invoices
  values.push(limit, offset);
  const invoicesResult = await client.query(
    `
      SELECT * FROM shared.invoices
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `,
    values
  );

  return {
    invoices: invoicesResult.rows,
    total,
  };
}

/**
 * Update invoice status
 */
export async function updateInvoiceStatus(
  client: PoolClient,
  invoiceId: string,
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible',
  paidAt?: Date
): Promise<unknown> {
  const updates: string[] = ['status = $1', 'updated_at = NOW()'];
  const values: unknown[] = [status];
  let paramIndex = 2;

  if (status === 'paid' && paidAt) {
    updates.push(`paid_at = $${paramIndex++}`);
    values.push(paidAt);
  }

  values.push(invoiceId);

  const result = await client.query(
    `
      UPDATE shared.invoices
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `,
    values
  );

  if (result.rowCount === 0) {
    throw new Error('Invoice not found');
  }

  return result.rows[0];
}

/**
 * Mark invoice as paid
 */
export async function markInvoiceAsPaid(
  client: PoolClient,
  invoiceId: string,
  paymentId: string
): Promise<unknown> {
  await client.query('BEGIN');
  try {
    // Update invoice
    const invoice = await updateInvoiceStatus(client, invoiceId, 'paid', new Date());

    // Link payment to invoice (if payment record exists)
    await client.query(
      `
        UPDATE shared.payments
        SET invoice_id = $1
        WHERE id = $2
      `,
      [invoiceId, paymentId]
    );

    await client.query('COMMIT');
    return invoice;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/**
 * Generate invoice PDF URL (placeholder - integrate with PDF service)
 */
export async function generateInvoicePdf(client: PoolClient, invoiceId: string): Promise<string> {
  const invoice = await getInvoiceById(client, invoiceId);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  // TODO: Integrate with PDF generation service (e.g., Puppeteer, PDFKit)
  // For now, return a placeholder URL
  const pdfUrl = `/api/invoices/${invoiceId}/pdf`;

  // Update invoice with PDF URL
  await client.query(
    `
      UPDATE shared.invoices
      SET pdf_url = $1, updated_at = NOW()
      WHERE id = $2
    `,
    [pdfUrl, invoiceId]
  );

  return pdfUrl;
}
