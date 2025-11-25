# Unused Exports Analysis

**Date:** 2025-11-25  
**Source:** `backups/unused_exports.json`  
**Status:** Under Review

---

## Analysis Methodology

1. Check if export is used internally within the same module (marked as "used in module")
2. Check if export is imported elsewhere in the codebase
3. Check if export is part of a public API (re-exported from index files)
4. Determine if export is truly unused or part of future API

---

## Category 1: Truly Unused (Safe to Remove)

### High Confidence - Can Remove

1. **`getExecutedMigrations`** - `src/db/runMigrationsWithTracking.ts:73`
   - Status: Not imported anywhere
   - Note: Internal helper function, not part of public API
   - **Action:** Can remove if not needed for migration scripts

2. **`runMigrationsWithTracking`** - `src/db/runMigrationsWithTracking.ts:84`
   - Status: Not imported anywhere (documentation suggests it should be used)
   - Note: Alternative migration runner, may be intentionally unused
   - **Action:** Review if this is meant to replace `runMigrations`

3. **`getErrorMessageWithFallback`** - `src/utils/errorUtils.ts:29`
   - Status: Not imported anywhere
   - Note: Alternative to `getErrorMessage`, likely redundant
   - **Action:** Can remove if `getErrorMessage` is sufficient

4. **`diagnoseLoginIssue`** - `src/utils/loginDiagnostics.ts:18`
   - Status: Not imported anywhere
   - Note: Diagnostic utility, may be for debugging only
   - **Action:** Can remove if not used in production

---

## Category 2: Re-exported (May Appear Unused)

These are exported from `lib/index.ts` but may be imported directly from source:

1. **`extractIpAddress`** - `src/lib/index.ts:9`
   - Actually used: Imported from `requestUtils.ts` directly
   - Status: Re-exported but not used via re-export
   - **Action:** Keep re-export for convenience, or remove if not needed

2. **`getClientIdentifier`** - `src/lib/index.ts:9`
   - Actually used: Imported from `requestUtils.ts` directly
   - Status: Re-exported but not used via re-export
   - **Action:** Keep re-export for convenience, or remove if not needed

---

## Category 3: Part of Public API (Keep)

These are exported but may be used by external code or are part of the public API:

1. **Response helpers** (`createSuccessResponse`, `createErrorResponse`, etc.)
   - Status: Part of public API
   - **Action:** Keep - may be used by external code

2. **Type definitions** (`ApiResponse`, `ApiErrorResponse`, etc.)
   - Status: Part of public API
   - **Action:** Keep - used for type checking

3. **Error classes** (`AuthError`, `InvalidCredentialsError`, etc.)
   - Status: Part of public API
   - **Action:** Keep - may be caught by error handlers

---

## Category 4: Internal Helpers (Review Needed)

1. **`createPutHandler`** - `src/lib/routeHelpers.ts:126`
   - Status: Not imported
   - **Action:** Review if this is a utility that should be used

2. **`validateBody`** - `src/lib/routeHelpers.ts:286`
   - Status: Not imported
   - **Action:** Review if this is a utility that should be used

---

## Recommended Actions

### Immediate (High Confidence)
1. Remove `getErrorMessageWithFallback` if `getErrorMessage` is sufficient
2. Remove `diagnoseLoginIssue` if not used in production
3. Review `getExecutedMigrations` and `runMigrationsWithTracking` usage

### Review Required
1. Review all re-exports in `lib/index.ts` - determine if they're needed
2. Review route helpers - determine if they should be used or removed
3. Review all "used in module" exports - verify they're truly internal

### Keep
1. All public API exports (response helpers, types, error classes)
2. All middleware exports (used in module)
3. All service exports (used in routes)

---

## Next Steps

1. Create test to verify exports are truly unused
2. Remove high-confidence unused exports
3. Update `delete_candidates.json` with safe-to-remove exports
4. Apply deletions in batches

