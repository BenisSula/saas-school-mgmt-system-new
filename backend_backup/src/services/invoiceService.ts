import crypto from 'crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { invoiceSchema } from '../validators/invoiceValidator';
import { assertValidSchemaName } from '../db/tenantManager';

type InvoiceInput = z.infer<typeof invoiceSchema>;

export async function createInvoice(
  client: PoolClient,
  schema: string,
  input: InvoiceInput,
  actorId?: string
) {
  assertValidSchemaName(schema);
  const id = crypto.randomUUID();
  const total = input.items.reduce((sum: number, item) => sum + item.amount, 0);

  await client.query('BEGIN');
  try {
    const invoiceResult = await client.query(
      `
        INSERT INTO ${schema}.fee_invoices (id, student_id, amount, status, due_date, metadata)
        VALUES ($1, $2, $3, 'pending', $4, $5)
        RETURNING *
      `,
      [
        id,
        input.studentId,
        total,
        input.dueDate ? new Date(input.dueDate) : null,
        JSON.stringify(input.metadata ?? {})
      ]
    );

    for (const item of input.items) {
      await client.query(
        `
          INSERT INTO ${schema}.fee_items (id, invoice_id, description, amount, metadata)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          crypto.randomUUID(),
          id,
          item.description,
          item.amount,
          JSON.stringify(item.metadata ?? {})
        ]
      );
    }

    await client.query('COMMIT');

    console.info('[audit] invoice_created', {
      tenantSchema: schema,
      invoiceId: id,
      studentId: input.studentId,
      amount: total,
      actorId: actorId ?? null
    });

    return invoiceResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

export async function getInvoicesForStudent(client: PoolClient, schema: string, studentId: string) {
  assertValidSchemaName(schema);
  const invoicesResult = await client.query(
    `
      SELECT *
      FROM ${schema}.fee_invoices
      WHERE student_id = $1
      ORDER BY created_at DESC
    `,
    [studentId]
  );

  const invoices = [];
  for (const invoice of invoicesResult.rows) {
    const items = await client.query(
      `
        SELECT description, amount
        FROM ${schema}.fee_items
        WHERE invoice_id = $1
      `,
      [invoice.id]
    );
    const payments = await client.query(
      `
        SELECT amount, status, received_at
        FROM ${schema}.payments
        WHERE invoice_id = $1
      `,
      [invoice.id]
    );

    invoices.push({
      ...invoice,
      items: items.rows,
      payments: payments.rows
    });
  }

  return invoices;
}

export async function updateInvoiceStatus(
  client: PoolClient,
  schema: string,
  invoiceId: string,
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'refunded'
) {
  await client.query(
    `
      UPDATE ${schema}.fee_invoices
      SET status = $2,
          updated_at = NOW()
      WHERE id = $1
    `,
    [invoiceId, status]
  );
}

export async function refreshInvoiceStatus(client: PoolClient, schema: string, invoiceId: string) {
  const invoiceResult = await client.query(
    `SELECT amount, status FROM ${schema}.fee_invoices WHERE id = $1`,
    [invoiceId]
  );
  if (invoiceResult.rowCount === 0) return;
  const invoice = invoiceResult.rows[0];
  const paymentsResult = await client.query(
    `SELECT COALESCE(SUM(amount), 0) AS total_paid FROM ${schema}.payments WHERE invoice_id = $1 AND status = 'succeeded'`,
    [invoiceId]
  );
  const totalPaid = Number(paymentsResult.rows[0]?.total_paid ?? 0);
  const amount = Number(invoice.amount);

  if (totalPaid >= amount && invoice.status !== 'paid') {
    await updateInvoiceStatus(client, schema, invoiceId, 'paid');
  } else if (totalPaid > 0 && totalPaid < amount && invoice.status !== 'partial') {
    await updateInvoiceStatus(client, schema, invoiceId, 'partial');
  }
}
