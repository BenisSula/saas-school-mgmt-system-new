# Phase 8.1 - Testing Checklist

**Billing & Stripe Integration Testing Guide**

---

## Unit Tests

### Backend Services

- [ ] `stripeService.getOrCreateStripeCustomer()` - Customer creation/retrieval
- [ ] `stripeService.createStripeSubscription()` - Subscription creation
- [ ] `stripeService.updateStripeSubscription()` - Plan updates with proration
- [ ] `stripeService.cancelStripeSubscription()` - Cancellation (immediate/period end)
- [ ] `stripeService.handleStripeInvoice()` - Invoice processing
- [ ] `stripeService.handleStripePaymentIntent()` - Payment processing

### Frontend Components

- [ ] `SubscriptionCard` - Display and actions
- [ ] `InvoiceList` - List rendering and pagination
- [ ] `AdminBillingPage` - Page integration

### React Query Hooks

- [ ] `useSubscription()` - Data fetching
- [ ] `useCreateSubscription()` - Mutation
- [ ] `useCancelSubscription()` - Mutation
- [ ] `useUpdatePlan()` - Mutation
- [ ] `useInvoices()` - Data fetching
- [ ] `usePayments()` - Data fetching

---

## Integration Tests

### Backend Routes

- [ ] `GET /admin/billing/subscription` - Returns subscription
- [ ] `POST /admin/billing/subscription/subscribe` - Creates subscription
- [ ] `POST /admin/billing/subscription/cancel` - Cancels subscription
- [ ] `POST /admin/billing/subscription/update-plan` - Updates plan
- [ ] `GET /admin/billing/invoices` - Returns invoices
- [ ] `GET /admin/billing/invoices/:id` - Returns invoice
- [ ] `GET /admin/billing/payments` - Returns payments

### Webhook Handler

- [ ] `POST /api/webhooks/stripe` - Signature verification
- [ ] `POST /api/webhooks/stripe` - Idempotency (duplicate events)
- [ ] `POST /api/webhooks/stripe` - `invoice.paid` event
- [ ] `POST /api/webhooks/stripe` - `invoice.payment_failed` event
- [ ] `POST /api/webhooks/stripe` - `customer.subscription.updated` event
- [ ] `POST /api/webhooks/stripe` - `customer.subscription.deleted` event
- [ ] `POST /api/webhooks/stripe` - `payment_intent.succeeded` event
- [ ] `POST /api/webhooks/stripe` - `payment_intent.payment_failed` event
- [ ] `POST /api/webhooks/stripe` - `charge.refunded` event

---

## E2E Tests

### Subscription Flow

- [ ] Admin creates subscription
- [ ] Subscription appears in Stripe Dashboard
- [ ] Subscription data stored in database
- [ ] Subscription displayed in admin billing page

### Plan Update Flow

- [ ] Admin updates subscription plan
- [ ] Proration calculated correctly
- [ ] Subscription updated in Stripe
- [ ] Database updated
- [ ] UI reflects changes

### Cancellation Flow

- [ ] Admin cancels subscription (at period end)
- [ ] Subscription marked for cancellation
- [ ] Subscription remains active until period end
- [ ] Admin can reactivate subscription

### Invoice Flow

- [ ] Invoice generated in Stripe
- [ ] Webhook receives `invoice.paid` event
- [ ] Invoice stored in database
- [ ] Invoice appears in admin billing page
- [ ] PDF download works

### Payment Flow

- [ ] Payment processed in Stripe
- [ ] Webhook receives `payment_intent.succeeded` event
- [ ] Payment stored in database
- [ ] Payment appears in payment history
- [ ] Invoice status updated

---

## Manual Testing Scenarios

### Scenario 1: New Subscription

1. Admin navigates to Billing page
2. Creates subscription with trial period
3. Verifies subscription in Stripe Dashboard
4. Checks database for subscription record
5. Verifies audit log entry

### Scenario 2: Plan Upgrade

1. Admin has active subscription
2. Updates to higher tier plan
3. Verifies proration in Stripe
4. Checks database for updated subscription
5. Verifies UI shows new plan

### Scenario 3: Invoice Payment

1. Stripe generates invoice
2. Customer pays invoice
3. Webhook receives `invoice.paid` event
4. Invoice status updated in database
5. Invoice appears as paid in UI

### Scenario 4: Payment Failure

1. Payment fails in Stripe
2. Webhook receives `invoice.payment_failed` event
3. Invoice status updated
4. Admin notified (if notification system implemented)

### Scenario 5: Subscription Cancellation

1. Admin cancels subscription
2. Subscription marked for cancellation at period end
3. Subscription remains active until period end
4. After period end, subscription canceled
5. UI reflects canceled status

---

## Test Data Setup

### Stripe Test Mode

1. Create test products in Stripe Dashboard
2. Create test prices (monthly/yearly)
3. Note Price IDs for testing
4. Configure test webhook endpoint

### Database Test Data

```sql
-- Test subscription
INSERT INTO shared.subscriptions (tenant_id, plan_id, status, ...)
VALUES ('test-tenant-id', 'test-plan', 'active', ...);

-- Test invoice
INSERT INTO shared.invoices (tenant_id, invoice_number, status, ...)
VALUES ('test-tenant-id', 'INV-TEST-001', 'paid', ...);
```

---

## Performance Testing

- [ ] Webhook processing time < 1 second
- [ ] Subscription creation < 2 seconds
- [ ] Invoice list loading < 1 second
- [ ] Payment history loading < 1 second

---

## Security Testing

- [ ] Webhook signature verification rejects invalid signatures
- [ ] RBAC prevents unauthorized access
- [ ] Idempotency prevents duplicate processing
- [ ] Audit logs capture all actions
- [ ] Sensitive data not exposed in responses

---

## Browser Compatibility

- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile browsers

---

## Error Handling

- [ ] Network errors handled gracefully
- [ ] Stripe API errors displayed to user
- [ ] Webhook errors logged
- [ ] Invalid input validation
- [ ] Missing data handled

---

**Testing Status:** ⏳ **PENDING**

Complete testing implementation recommended before production deployment.

