# PHASE B6 — Deletion Checklist

## Files/Functions to Delete

### 1. apiErrors.ts (Entire File) ✅
- **Status:** No imports found
- **Canonical:** responseHelpers.ts
- **Action:** Delete entire file

### 2. extractIpAddress from superuserHelpers.ts ✅
- **Status:** Only used in requestUtils.ts (canonical)
- **Note:** superuserHelpers.ts still needed for other functions
- **Action:** Remove only extractIpAddress function

### 3. getClientIdentifier from rateLimiter.ts ✅
- **Status:** No imports found
- **Canonical:** requestUtils.ts
- **Action:** Remove only getClientIdentifier function

### 4. validatePasswordStrength from validation.ts ✅
- **Status:** No imports found (replaced in authValidation.ts)
- **Canonical:** passwordPolicyService.ts
- **Action:** Remove function and PasswordValidationResult interface

### 5. requireTenantContext/requireUserContext/requireContext from routeHelpers.ts ✅
- **Status:** No actual usages (all replaced with validateContextOrRespond)
- **Note:** Still exported in index.ts
- **Action:** Remove from exports, then delete functions

### 6. Inline schemas in routes ✅
- **Status:** Already replaced with imports
- **Action:** Verify no inline definitions remain

### 7. .dockerignore files ✅
- **Status:** Consolidated to root .dockerignore
- **Action:** Delete backend/.dockerignore and frontend/.dockerignore

