import crypto from 'crypto';
import type { PoolClient } from 'pg';
import { assertValidSchemaName } from '../db/tenantManager';
import { refreshInvoiceStatus } from './invoiceService';
import type { WebhookEvent } from './payments/provider';

export async function recordPaymentEvent(client: PoolClient, schema: string, event: WebhookEvent) {
  assertValidSchemaName(schema);
  await client.query(
    `
      INSERT INTO ${schema}.payments (
        id,
        invoice_id,
        provider,
        provider_payment_id,
        amount,
        currency,
        status,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (provider, provider_payment_id)
      DO UPDATE SET
        status = EXCLUDED.status,
        amount = EXCLUDED.amount,
        currency = EXCLUDED.currency,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `,
    [
      crypto.randomUUID(),
      event.invoiceId,
      event.provider,
      event.paymentId,
      event.amount,
      event.currency,
      event.type === 'payment.succeeded'
        ? 'succeeded'
        : event.type === 'payment.failed'
          ? 'failed'
          : 'refunded',
      JSON.stringify(event.rawPayload ?? {}),
    ]
  );

  await refreshInvoiceStatus(client, schema, event.invoiceId);

  console.info('[audit] payment_recorded', {
    tenantSchema: schema,
    invoiceId: event.invoiceId,
    provider: event.provider,
    paymentId: event.paymentId,
    status: event.type,
  });
}
