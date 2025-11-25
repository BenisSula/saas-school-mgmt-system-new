# Phase 8.1 - Quick Start Guide

**Billing & Stripe Integration**

---

## Quick Setup (5 Minutes)

### 1. Install Dependencies

```bash
cd backend
npm install stripe
```

### 2. Configure Environment

Add to `.env`:

```bash
STRIPE_SECRET_KEY=sk_test_51...
STRIPE_WEBHOOK_SECRET=whsec_...
BILLING_DEFAULT_CURRENCY=USD
```

### 3. Run Migration

```bash
npm run migrate
```

### 4. Start Server

```bash
npm run dev
```

### 5. Configure Stripe Webhook (Local Development)

```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

# Forward webhooks to local server
stripe listen --forward-to localhost:3001/api/webhooks/stripe

# Copy the webhook secret from CLI output to .env
```

### 6. Test

1. Navigate to `/dashboard/admin/billing`
2. View subscription (if exists)
3. View invoices
4. Check payment history

---

## Production Deployment

1. **Set Production Keys**
   - Use `sk_live_...` for `STRIPE_SECRET_KEY`
   - Get production webhook secret from Stripe Dashboard

2. **Configure Webhook Endpoint**
   - URL: `https://your-domain.com/api/webhooks/stripe`
   - Select required events in Stripe Dashboard

3. **Deploy**
   - Build and deploy backend
   - Build and deploy frontend
   - Verify webhook delivery

---

## Troubleshooting

**Webhook not receiving events?**
- Check webhook URL is publicly accessible
- Verify `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
- Check server logs for errors

**Subscription creation fails?**
- Verify Stripe secret key is correct
- Check Stripe Dashboard for errors
- Verify price IDs exist in Stripe

**Frontend errors?**
- Ensure permissions are configured
- Check API base URL is correct
- Verify user has `billing:view` permission

---

**For detailed information, see:**
- [Implementation Summary](./PHASE8_BILLING_IMPLEMENTATION.md)
- [Webhook Configuration](./STRIPE_WEBHOOK_CONFIGURATION.md)
- [Deployment Guide](./PHASE8_DEPLOYMENT_GUIDE.md)

