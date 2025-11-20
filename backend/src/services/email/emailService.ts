import type { PoolClient } from 'pg';
import { z } from 'zod';

export interface EmailTemplate {
  templateKey: string;
  templateName: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  variables: Record<string, unknown>;
}

export interface SendEmailInput {
  tenantId?: string;
  templateKey: string;
  recipientEmail: string;
  recipientName?: string;
  variables?: Record<string, unknown>;
  priority?: number;
  scheduledAt?: Date;
}

/**
 * Simple template variable replacement
 */
function replaceTemplateVariables(
  template: string,
  variables: Record<string, unknown>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    result = result.replace(regex, String(value));
  }
  return result;
}

/**
 * Get email template (tenant-specific or platform-wide)
 */
export async function getEmailTemplate(
  client: PoolClient,
  templateKey: string,
  tenantId?: string
): Promise<EmailTemplate | null> {
  // Try tenant-specific template first
  if (tenantId) {
    const tenantResult = await client.query(
      `
        SELECT * FROM shared.email_templates
        WHERE template_key = $1 AND tenant_id = $2 AND is_active = TRUE
        ORDER BY version DESC
        LIMIT 1
      `,
      [templateKey, tenantId]
    );

    if (tenantResult.rowCount > 0) {
      const row = tenantResult.rows[0];
      return {
        templateKey: row.template_key,
        templateName: row.template_name,
        subject: row.subject,
        bodyHtml: row.body_html,
        bodyText: row.body_text,
        variables: row.variables || {}
      };
    }
  }

  // Fall back to platform-wide template
  const platformResult = await client.query(
    `
      SELECT * FROM shared.email_templates
      WHERE template_key = $1 AND tenant_id IS NULL AND is_active = TRUE
      ORDER BY version DESC
      LIMIT 1
    `,
    [templateKey]
  );

  if (platformResult.rowCount === 0) {
    return null;
  }

  const row = platformResult.rows[0];
  return {
    templateKey: row.template_key,
    templateName: row.template_name,
    subject: row.subject,
    bodyHtml: row.body_html,
    bodyText: row.body_text,
    variables: row.variables || {}
  };
}

/**
 * Queue email for sending
 */
export async function queueEmail(
  client: PoolClient,
  input: SendEmailInput
): Promise<{ id: string; queued: boolean }> {
  // Get template
  const template = await getEmailTemplate(client, input.templateKey, input.tenantId);
  if (!template) {
    throw new Error(`Email template '${input.templateKey}' not found`);
  }

  // Replace variables in subject and body
  const variables = input.variables || {};
  const subject = replaceTemplateVariables(template.subject, variables);
  const bodyHtml = replaceTemplateVariables(template.bodyHtml, variables);
  const bodyText = template.bodyText
    ? replaceTemplateVariables(template.bodyText, variables)
    : null;

  // Insert into queue
  const result = await client.query(
    `
      INSERT INTO shared.email_queue (
        tenant_id, template_key, recipient_email, recipient_name,
        subject, body_html, body_text, variables, priority, scheduled_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `,
    [
      input.tenantId || null,
      input.templateKey,
      input.recipientEmail,
      input.recipientName || null,
      subject,
      bodyHtml,
      bodyText,
      JSON.stringify(variables),
      input.priority || 5,
      input.scheduledAt || new Date()
    ]
  );

  return {
    id: result.rows[0].id,
    queued: true
  };
}

/**
 * Send email (process queue item)
 * In production, this would integrate with SendGrid, AWS SES, etc.
 */
export async function sendEmail(
  client: PoolClient,
  queueId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Get email from queue
  const queueResult = await client.query(
    'SELECT * FROM shared.email_queue WHERE id = $1',
    [queueId]
  );

  if (queueResult.rowCount === 0) {
    throw new Error('Email queue item not found');
  }

  const email = queueResult.rows[0];

  if (email.status === 'sent') {
    return { success: true, messageId: email.provider_message_id };
  }

  // Update status to sending
  await client.query(
    'UPDATE shared.email_queue SET status = $1, updated_at = NOW() WHERE id = $2',
    ['sending', queueId]
  );

  try {
    // TODO: Integrate with real email provider (SendGrid, AWS SES, etc.)
    // For now, simulate sending
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Update queue status
    await client.query(
      `
        UPDATE shared.email_queue
        SET status = 'sent',
            sent_at = NOW(),
            provider_message_id = $1,
            updated_at = NOW()
        WHERE id = $2
      `,
      [messageId, queueId]
    );

    // Record in history
    await client.query(
      `
        INSERT INTO shared.email_history (
          queue_id, tenant_id, template_key, recipient_email,
          subject, status, provider_message_id
        )
        VALUES ($1, $2, $3, $4, $5, 'sent', $6)
      `,
      [
        queueId,
        email.tenant_id,
        email.template_key,
        email.recipient_email,
        email.subject,
        messageId
      ]
    );

    // Log email sending (in production, this would actually send via SMTP/API)
    console.log(`[email] Sent email to ${email.recipient_email}`, {
      templateKey: email.template_key,
      messageId,
      subject: email.subject
    });

    return { success: true, messageId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const retryCount = email.retry_count + 1;

    if (retryCount >= email.max_retries) {
      // Mark as failed
      await client.query(
        `
          UPDATE shared.email_queue
          SET status = 'failed',
              failed_at = NOW(),
              failure_reason = $1,
              retry_count = $2,
              updated_at = NOW()
          WHERE id = $3
        `,
        [errorMessage, retryCount, queueId]
      );

      // Record in history
      await client.query(
        `
          INSERT INTO shared.email_history (
            queue_id, tenant_id, template_key, recipient_email,
            subject, status
          )
          VALUES ($1, $2, $3, $4, $5, 'failed')
        `,
        [
          queueId,
          email.tenant_id,
          email.template_key,
          email.recipient_email,
          email.subject
        ]
      );
    } else {
      // Retry later
      await client.query(
        `
          UPDATE shared.email_queue
          SET status = 'pending',
              retry_count = $1,
              updated_at = NOW()
          WHERE id = $2
        `,
        [retryCount, queueId]
      );
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Process email queue (should be called by a cron job)
 */
export async function processEmailQueue(
  client: PoolClient,
  batchSize: number = 10
): Promise<{ processed: number; succeeded: number; failed: number }> {
  // Get pending emails ordered by priority and scheduled_at
  const queueResult = await client.query(
    `
      SELECT id FROM shared.email_queue
      WHERE status IN ('pending', 'sending')
      AND scheduled_at <= NOW()
      ORDER BY priority ASC, scheduled_at ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    `,
    [batchSize]
  );

  let succeeded = 0;
  let failed = 0;

  for (const row of queueResult.rows) {
    const result = await sendEmail(client, row.id);
    if (result.success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  return {
    processed: queueResult.rowCount,
    succeeded,
    failed
  };
}

/**
 * Create or update email template
 */
export async function upsertEmailTemplate(
  client: PoolClient,
  template: {
    templateKey: string;
    templateName: string;
    subject: string;
    bodyHtml: string;
    bodyText?: string;
    variables?: Record<string, unknown>;
    tenantId?: string;
  }
): Promise<unknown> {
  // Get current version
  const versionResult = await client.query(
    `
      SELECT MAX(version) as max_version
      FROM shared.email_templates
      WHERE template_key = $1 AND (tenant_id = $2 OR ($2 IS NULL AND tenant_id IS NULL))
    `,
    [template.templateKey, template.tenantId || null]
  );

  const nextVersion = (versionResult.rows[0]?.max_version || 0) + 1;

  const result = await client.query(
    `
      INSERT INTO shared.email_templates (
        template_key, template_name, subject, body_html, body_text,
        variables, tenant_id, version
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      template.templateKey,
      template.templateName,
      template.subject,
      template.bodyHtml,
      template.bodyText || null,
      JSON.stringify(template.variables || {}),
      template.tenantId || null,
      nextVersion
    ]
  );

  return result.rows[0];
}

