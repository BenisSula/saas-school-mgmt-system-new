# Stripe Webhook Configuration Guide

**Phase 8.1 - Billing & Stripe Integration**

---

## Overview

This guide explains how to configure Stripe webhooks for the SaaS Academy Platform billing system.

---

## Prerequisites

1. Stripe account (test or production)
2. Backend server accessible from the internet (for webhook delivery)
3. Environment variables configured

---

## Step 1: Get Webhook Signing Secret

1. Log in to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **Webhooks**
3. Click **Add endpoint**
4. Enter your webhook URL: `https://your-domain.com/api/webhooks/stripe`
5. Select events to listen to:
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
6. Click **Add endpoint**
7. Copy the **Signing secret** (starts with `whsec_`)

---

## Step 2: Configure Environment Variables

Add the following to your `.env` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...                    # Your Stripe secret key
STRIPE_WEBHOOK_SECRET=whsec_...                  # Webhook signing secret from Step 1
BILLING_DEFAULT_CURRENCY=USD                     # Default currency
```

**For Production:**
- Use `sk_live_...` for `STRIPE_SECRET_KEY`
- Use production webhook signing secret

---

## Step 3: Test Webhook Locally (Development)

### Using Stripe CLI

1. Install [Stripe CLI](https://stripe.com/docs/stripe-cli)

2. Login to Stripe:
```bash
stripe login
```

3. Forward webhooks to local server:
```bash
stripe listen --forward-to localhost:3001/api/webhooks/stripe
```

4. Copy the webhook signing secret from the CLI output (starts with `whsec_`)

5. Update your `.env` with the local webhook secret

6. Trigger test events:
```bash
stripe trigger invoice.paid
stripe trigger customer.subscription.updated
```

---

## Step 4: Verify Webhook Configuration

### Check Webhook Delivery

1. In Stripe Dashboard → **Developers** → **Webhooks**
2. Click on your webhook endpoint
3. View **Events** tab to see delivery status
4. Check **Logs** for any errors

### Test Events

Use Stripe Dashboard to send test events:
1. Go to **Developers** → **Webhooks**
2. Click on your endpoint
3. Click **Send test webhook**
4. Select event type and click **Send test webhook**

---

## Step 5: Monitor Webhook Health

### Health Checks

The webhook endpoint returns:
- `200 OK` with `{ received: true }` on success
- `400 Bad Request` if signature verification fails
- `500 Internal Server Error` on processing errors

### Idempotency

- Webhook events are stored in `shared.external_events` table
- Duplicate events are automatically ignored
- Check `processed_at` column to verify processing

### Audit Logs

All webhook events create audit log entries:
- `SUBSCRIPTION_CREATED`
- `SUBSCRIPTION_UPDATED`
- `SUBSCRIPTION_CANCELED`
- `PAYMENT_SUCCEEDED`
- `PAYMENT_FAILED`
- `INVOICE_GENERATED`
- `PAYMENT_REFUNDED`

---

## Troubleshooting

### Webhook Not Receiving Events

1. **Check URL Accessibility**
   - Ensure webhook URL is publicly accessible
   - Test with: `curl https://your-domain.com/api/webhooks/stripe`

2. **Verify Signature Secret**
   - Ensure `STRIPE_WEBHOOK_SECRET` matches the signing secret from Stripe Dashboard
   - For local development, use the secret from `stripe listen` command

3. **Check Server Logs**
   - Look for webhook processing errors
   - Check for signature verification failures

### Signature Verification Failures

**Error:** `Webhook signature verification failed`

**Solutions:**
- Ensure webhook route uses raw body parser (already configured)
- Verify `STRIPE_WEBHOOK_SECRET` is correct
- Check that webhook URL in Stripe matches your server URL

### Duplicate Event Processing

**Issue:** Events processed multiple times

**Solution:**
- Idempotency is handled automatically via `shared.external_events` table
- Check `processed_at` column to verify single processing

---

## Security Best Practices

1. **Always Verify Signatures**
   - Never disable signature verification
   - Use HTTPS for webhook endpoints

2. **Rate Limiting**
   - Webhook endpoint should have rate limiting (already configured)
   - Monitor for abuse

3. **Idempotency**
   - Always check for duplicate events
   - Use event IDs for idempotency keys

4. **Error Handling**
   - Log all webhook errors
   - Retry failed events (Stripe automatically retries)

---

## Production Checklist

- [ ] Webhook URL is publicly accessible
- [ ] HTTPS enabled for webhook endpoint
- [ ] Production Stripe keys configured
- [ ] Webhook signing secret from production endpoint
- [ ] All required events selected in Stripe Dashboard
- [ ] Monitoring and alerting configured
- [ ] Error logging enabled
- [ ] Rate limiting configured

---

## Support

For issues or questions:
1. Check Stripe Dashboard webhook logs
2. Review server logs for errors
3. Verify environment variables
4. Test with Stripe CLI locally

---

**Last Updated:** 2025-01-XX

