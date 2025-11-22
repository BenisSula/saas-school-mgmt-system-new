# Phase 8.1 - Deployment Guide

**Billing & Stripe Integration Deployment**

---

## Pre-Deployment Checklist

### Backend

- [x] Database migration `029_stripe_integration_fields.sql` created
- [x] Stripe SDK installed (`npm install stripe`)
- [x] Environment variables documented
- [x] Webhook route configured
- [x] Admin billing routes protected with RBAC
- [x] Audit logging implemented

### Frontend

- [x] API client functions added
- [x] React Query hooks created
- [x] Billing pages and components created
- [x] Routes added to App.tsx
- [x] Permissions configured

---

## Deployment Steps

### 1. Database Migration

Run the migration for all tenants:

```bash
# From backend directory
npm run migrate
```

Or run the Phase 7 migration script (if it includes Phase 8 migrations):

```bash
npx ts-node src/scripts/runPhase7Migrations.ts
```

**Verify:**
```sql
-- Check Stripe fields exist
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'shared' 
AND table_name = 'subscriptions' 
AND column_name LIKE 'stripe%';

-- Check external_events table exists
SELECT * FROM shared.external_events LIMIT 1;
```

### 2. Environment Variables

Add to production `.env`:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_...                    # Production secret key
STRIPE_WEBHOOK_SECRET=whsec_...                  # Production webhook secret
BILLING_DEFAULT_CURRENCY=USD                     # Default currency
```

**Security:**
- Store secrets in secure vault (AWS Secrets Manager, Azure Key Vault, etc.)
- Never commit secrets to version control
- Rotate secrets regularly

### 3. Stripe Configuration

1. **Create Products & Prices in Stripe Dashboard**
   - Create subscription products
   - Create prices (monthly/yearly)
   - Note the Price IDs (starts with `price_`)

2. **Configure Webhook Endpoint**
   - Follow [Stripe Webhook Configuration Guide](./STRIPE_WEBHOOK_CONFIGURATION.md)
   - URL: `https://your-domain.com/api/webhooks/stripe`
   - Select required events

3. **Test Webhook Delivery**
   - Send test events from Stripe Dashboard
   - Verify events are processed
   - Check audit logs

### 4. Build & Deploy

**Backend:**
```bash
cd backend
npm run build
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
# Deploy dist/ to your hosting service
```

### 5. Verify Deployment

**Backend Health:**
```bash
curl https://your-domain.com/health
```

**Webhook Endpoint:**
```bash
curl -X POST https://your-domain.com/api/webhooks/stripe \
  -H "stripe-signature: test" \
  -d '{}'
# Should return 400 (signature verification expected to fail)
```

**Admin Billing Page:**
- Navigate to `/dashboard/admin/billing`
- Verify subscription card loads
- Check invoices list
- Verify payment history

---

## Post-Deployment Verification

### 1. Test Subscription Creation

1. Log in as admin
2. Navigate to Billing page
3. Create test subscription with Stripe test price ID
4. Verify subscription appears in Stripe Dashboard
5. Check database for subscription record

### 2. Test Webhook Events

1. Create test subscription in Stripe Dashboard
2. Verify webhook events are received
3. Check `shared.external_events` for processed events
4. Verify audit logs created

### 3. Test Invoice Generation

1. Trigger invoice creation in Stripe
2. Verify invoice appears in admin billing page
3. Check PDF URL is accessible
4. Verify invoice stored in database

### 4. Test Payment Processing

1. Create test payment in Stripe
2. Verify payment appears in payment history
3. Check payment status updates
4. Verify audit logs

---

## Monitoring

### Key Metrics

- Webhook delivery success rate
- Payment success rate
- Subscription creation rate
- Invoice generation rate
- Error rate

### Alerts

Configure alerts for:
- Webhook delivery failures
- Payment failures
- Subscription cancellations
- High error rates

---

## Rollback Plan

If issues occur:

1. **Disable Webhook Endpoint**
   - Remove webhook URL from Stripe Dashboard
   - Or disable in application config

2. **Revert Code**
   - Deploy previous version
   - Keep database changes (non-breaking)

3. **Database Rollback (if needed)**
   ```sql
   -- Remove Stripe fields (if necessary)
   ALTER TABLE shared.subscriptions 
   DROP COLUMN IF EXISTS stripe_subscription_id,
   DROP COLUMN IF EXISTS stripe_customer_id,
   DROP COLUMN IF EXISTS price_cents,
   DROP COLUMN IF EXISTS billing_interval;
   ```

---

## Support & Troubleshooting

See:
- [Stripe Webhook Configuration Guide](./STRIPE_WEBHOOK_CONFIGURATION.md)
- [Phase 8 Implementation Summary](./PHASE8_BILLING_IMPLEMENTATION.md)

---

**Last Updated:** 2025-01-XX

