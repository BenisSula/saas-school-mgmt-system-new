-- Seed default email templates

INSERT INTO shared.email_templates (template_key, template_name, subject, body_html, body_text, variables, is_active)
VALUES
  (
    'tenant_invitation',
    'Tenant Invitation',
    'You''ve been invited to join {{tenantName}}',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .footer { margin-top: 30px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>You''ve been invited!</h1>
    <p>Hello,</p>
    <p>You''ve been invited to join <strong>{{tenantName}}</strong> as a <strong>{{role}}</strong>.</p>
    <p>Click the button below to accept your invitation and set up your account:</p>
    <a href="{{invitationUrl}}" class="button">Accept Invitation</a>
    <p>This invitation will expire in {{expiresInHours}} hours.</p>
    <p>If you didn''t expect this invitation, you can safely ignore this email.</p>
    <div class="footer">
      <p>Best regards,<br>The Team</p>
    </div>
  </div>
</body>
</html>',
    'You''ve been invited to join {{tenantName}} as a {{role}}.

Accept your invitation by visiting: {{invitationUrl}}

This invitation will expire in {{expiresInHours}} hours.

If you didn''t expect this invitation, you can safely ignore this email.',
    '{"tenantName": "string", "role": "string", "invitationUrl": "string", "expiresInHours": "number"}'::jsonb,
    TRUE
  ),
  (
    'welcome',
    'Welcome Email',
    'Welcome to {{tenantName}}!',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Welcome, {{name}}!</h1>
    <p>Thank you for joining <strong>{{tenantName}}</strong>.</p>
    <p>Your account has been successfully created with the role of <strong>{{role}}</strong>.</p>
    <p>You can now log in and start using the platform.</p>
    <a href="{{loginUrl}}" class="button">Log In</a>
    <p>If you have any questions, please don''t hesitate to contact support.</p>
  </div>
</body>
</html>',
    'Welcome, {{name}}!

Thank you for joining {{tenantName}}.

Your account has been successfully created with the role of {{role}}.

Log in at: {{loginUrl}}

If you have any questions, please contact support.',
    '{"name": "string", "tenantName": "string", "role": "string", "loginUrl": "string"}'::jsonb,
    TRUE
  ),
  (
    'payment_receipt',
    'Payment Receipt',
    'Payment Receipt - Invoice {{invoiceNumber}}',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .receipt { background-color: #f9f9f9; padding: 20px; border-radius: 4px; margin: 20px 0; }
    .amount { font-size: 24px; font-weight: bold; color: #28a745; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Payment Receipt</h1>
    <p>Hello {{customerName}},</p>
    <p>Thank you for your payment. Your payment has been successfully processed.</p>
    <div class="receipt">
      <p><strong>Invoice Number:</strong> {{invoiceNumber}}</p>
      <p><strong>Amount Paid:</strong> <span class="amount">{{amount}} {{currency}}</span></p>
      <p><strong>Payment Date:</strong> {{paymentDate}}</p>
      <p><strong>Payment Method:</strong> {{paymentMethod}}</p>
    </div>
    <p>You can download your invoice <a href="{{invoiceUrl}}">here</a>.</p>
    <p>If you have any questions, please contact our support team.</p>
  </div>
</body>
</html>',
    'Payment Receipt

Hello {{customerName}},

Thank you for your payment. Your payment has been successfully processed.

Invoice Number: {{invoiceNumber}}
Amount Paid: {{amount}} {{currency}}
Payment Date: {{paymentDate}}
Payment Method: {{paymentMethod}}

Download invoice: {{invoiceUrl}}

If you have any questions, please contact support.',
    '{"customerName": "string", "invoiceNumber": "string", "amount": "number", "currency": "string", "paymentDate": "string", "paymentMethod": "string", "invoiceUrl": "string"}'::jsonb,
    TRUE
  ),
  (
    'dunning_notice',
    'Dunning Notice',
    'Payment Reminder - Invoice {{invoiceNumber}}',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .warning { background-color: #fff3cd; padding: 20px; border-radius: 4px; border-left: 4px solid #ffc107; margin: 20px 0; }
    .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Payment Reminder</h1>
    <p>Hello {{customerName}},</p>
    <div class="warning">
      <p><strong>This is a reminder</strong> that your invoice <strong>{{invoiceNumber}}</strong> is overdue.</p>
      <p><strong>Amount Due:</strong> {{amount}} {{currency}}</p>
      <p><strong>Due Date:</strong> {{dueDate}}</p>
      <p><strong>Days Overdue:</strong> {{daysOverdue}}</p>
    </div>
    <p>Please make payment as soon as possible to avoid service interruption.</p>
    <a href="{{paymentUrl}}" class="button">Pay Now</a>
    <p>If you''ve already made this payment, please ignore this notice.</p>
  </div>
</body>
</html>',
    'Payment Reminder

Hello {{customerName}},

This is a reminder that your invoice {{invoiceNumber}} is overdue.

Amount Due: {{amount}} {{currency}}
Due Date: {{dueDate}}
Days Overdue: {{daysOverdue}}

Please make payment as soon as possible: {{paymentUrl}}

If you''ve already made this payment, please ignore this notice.',
    '{"customerName": "string", "invoiceNumber": "string", "amount": "number", "currency": "string", "dueDate": "string", "daysOverdue": "number", "paymentUrl": "string"}'::jsonb,
    TRUE
  ),
  (
    'quota_exceeded',
    'Quota Exceeded Warning',
    'Quota Limit Reached - {{resourceType}}',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .alert { background-color: #f8d7da; padding: 20px; border-radius: 4px; border-left: 4px solid #dc3545; margin: 20px 0; }
    .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Quota Limit Reached</h1>
    <p>Hello {{adminName}},</p>
    <div class="alert">
      <p><strong>Warning:</strong> Your {{resourceType}} quota has been exceeded.</p>
      <p><strong>Current Usage:</strong> {{currentUsage}} / {{limit}}</p>
      <p><strong>Resource Type:</strong> {{resourceType}}</p>
    </div>
    <p>To continue using this service, please upgrade your plan or contact support.</p>
    <a href="{{upgradeUrl}}" class="button">Upgrade Plan</a>
    <p>If you have any questions, please contact our support team.</p>
  </div>
</body>
</html>',
    'Quota Limit Reached

Hello {{adminName}},

Warning: Your {{resourceType}} quota has been exceeded.

Current Usage: {{currentUsage}} / {{limit}}
Resource Type: {{resourceType}}

To continue using this service, please upgrade your plan: {{upgradeUrl}}

If you have any questions, please contact support.',
    '{"adminName": "string", "resourceType": "string", "currentUsage": "number", "limit": "number", "upgradeUrl": "string"}'::jsonb,
    TRUE
  ),
  (
    'report_delivery',
    'Report Delivery',
    'Your scheduled report: {{reportName}}',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Your Report is Ready</h1>
    <p>Hello,</p>
    <p>Your scheduled report <strong>{{reportName}}</strong> has been generated.</p>
    <p><strong>Report Details:</strong></p>
    <ul>
      <li>Rows: {{rowCount}}</li>
      <li>Format: {{format}}</li>
      <li>Generated: {{generatedAt}}</li>
    </ul>
    <a href="{{downloadUrl}}" class="button">Download Report</a>
    <p>This link will expire in 7 days.</p>
  </div>
</body>
</html>',
    'Your scheduled report {{reportName}} has been generated.

Report Details:
- Rows: {{rowCount}}
- Format: {{format}}
- Generated: {{generatedAt}}

Download: {{downloadUrl}}

This link will expire in 7 days.',
    '{"reportName": "string", "reportDescription": "string", "rowCount": "number", "generatedAt": "string", "downloadUrl": "string", "format": "string"}'::jsonb,
    TRUE
  )
ON CONFLICT (template_key, tenant_id, version) DO NOTHING;

