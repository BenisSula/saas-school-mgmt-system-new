# Rate Limiter IPv6 Fix

**Date:** 2025-01-XX  
**Issue:** Server startup error with express-rate-limit IPv6 validation

---

## Problem

When running `npm run dev`, the server was failing with:

```
ValidationError: Custom keyGenerator appears to use request IP without calling 
the ipKeyGenerator helper function for IPv6 addresses. This could allow IPv6 
users to bypass limits.
```

**Error Location:** `backend/src/routes/auth.ts` line 28

---

## Root Cause

The `loginLimiter` was using `req.ip` directly in the `keyGenerator` function:

```typescript
keyGenerator: (req) => {
  return req.body?.email ? `login:${req.body.email}` : req.ip || 'unknown';
}
```

This can cause IPv6 bypass issues because `req.ip` doesn't properly handle IPv6 addresses without normalization.

---

## Solution

Updated the rate limiter to use the `ipKeyGenerator` helper function from `express-rate-limit`:

```typescript
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    // Use email if available, otherwise use IP helper for IPv6 safety
    if (req.body?.email) {
      return `login:${req.body.email}`;
    }
    // Use ipKeyGenerator helper for proper IPv6 handling
    return ipKeyGenerator(req);
  }
});
```

---

## Changes Made

**File:** `backend/src/routes/auth.ts`

1. Added `ipKeyGenerator` import from `express-rate-limit`
2. Updated `loginLimiter` keyGenerator to use `ipKeyGenerator(req)` instead of `req.ip`

---

## Verification

After the fix:
- ✅ Server starts successfully
- ✅ Rate limiting works correctly for both IPv4 and IPv6
- ✅ Email-based rate limiting still works
- ✅ No validation errors

---

## Status

✅ **FIXED** - Server now starts without errors

