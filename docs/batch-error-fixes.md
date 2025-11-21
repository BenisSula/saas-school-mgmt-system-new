# BATCH ERROR FIXES

**Total Errors:** 77  
**Strategy:** Fix by error category

## FIXES TO APPLY

### 1. SSO Route - Fix remaining type error
- Line 103: Fix provider.find type assertion

### 2. SuperUser Routes - Fix filter types
- `overrides.ts`: Fix `overrideType` string vs OverrideType
- `schools.ts`: Fix `active` vs `isActive` property
- `users.ts`: Fix `active` vs `isActive` property

### 3. Null Safety - Add null checks
- Add `?? 0` or `|| 0` for rowCount checks
- Handle null cases appropriately

### 4. Knowledge Base - Fix slug types
- Handle optional slug fields with defaults

### 5. Service Layer - Fix type errors
- Student service: Fix empty object types
- OAuth service: Already fixed
- Add otplib stub or dependency

---

**Applying fixes now...**

