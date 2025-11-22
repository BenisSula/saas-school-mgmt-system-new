# Stripe Lazy Initialization Fix

**Date:** 2025-01-XX  
**Status:** ✅ **FIXED**

---

## 🐛 Problem

The server was failing to start with the error:
```
Error: STRIPE_SECRET_KEY environment variable is required
```

This occurred because the Stripe service was checking for environment variables at **module load time** (when the file was imported), not when the service was actually used. This meant:

- ❌ Server couldn't start without Stripe keys
- ❌ Billing routes couldn't be imported without Stripe configured
- ❌ Development environment required Stripe keys even if not using billing features

---

## ✅ Solution

Implemented **lazy initialization** for Stripe client:

### Changes Made

1. **`backend/src/services/billing/stripeService.ts`**
   - Removed module-level Stripe client initialization
   - Added `getStripeClient()` function that initializes Stripe only when called
   - Replaced all `stripe.` calls with `getStripeClient().`
   - Environment variable check now happens when Stripe is actually used

2. **`backend/src/routes/webhooks/stripe.ts`**
   - Removed module-level Stripe client initialization
   - Added `getStripeClient()` function for lazy initialization
   - Changed `stripe.webhooks.constructEvent` to `Stripe.webhooks.constructEvent` (static method)
   - Webhook secret check now happens when webhook endpoint is hit

---

## 📝 Code Changes

### Before
```typescript
// Module-level initialization - runs when file is imported
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-11-17.clover',
  typescript: true
});
```

### After
```typescript
// Lazy initialization - only runs when Stripe is actually used
let stripeInstance: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required. Please set it in your .env file.');
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-11-17.clover',
      typescript: true
    });
  }
  return stripeInstance;
}
```

---

## ✅ Benefits

1. **Server can start without Stripe keys** - Only fails when billing features are actually used
2. **Better error messages** - More helpful error when Stripe is needed but not configured
3. **Development-friendly** - Can develop other features without Stripe configuration
4. **Production-safe** - Still validates keys when billing features are used

---

## 🧪 Testing

### Before Fix
```bash
npm run dev
# ❌ Error: STRIPE_SECRET_KEY environment variable is required
```

### After Fix
```bash
npm run dev
# ✅ Server starts successfully
# ✅ Only errors when billing endpoints are actually called without keys
```

---

## 📋 Usage

### For Development (No Stripe)
- Server starts normally
- Billing routes can be imported
- Error only occurs when calling billing endpoints

### For Production (With Stripe)
- Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in `.env`
- Billing features work normally
- No changes to existing code needed

---

## ✅ Status

**FIXED** - Server now starts successfully without Stripe environment variables. Stripe initialization only occurs when billing features are actually used.

