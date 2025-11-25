# Complete Consolidation Workflow

**Purpose:** Step-by-step guide for consolidating duplicate functions following the complete workflow that enables safe deletion.

---

## Workflow Steps

### 1. Identify Duplicate Functions
- Use `duplicate_signatures.txt` to find duplicates
- Verify they have identical or compatible signatures
- Check that they serve the same purpose (not just same name)

### 2. Choose Canonical Implementation
- Select the cleanest, most complete implementation
- Prefer implementations in `src/lib/` (shared utilities)
- Consider which has better error handling, documentation, tests

### 3. Create Canonical in `src/lib/`
- Move or copy the chosen implementation to `src/lib/<name>.ts`
- Ensure it's properly exported
- Add comprehensive JSDoc comments

### 4. Create Backup Files
- For each original file with duplicate:
  - Copy original to `<original-path>.backup.ts`
  - This preserves history and allows rollback

### 5. Replace with Re-export Shim
- Replace original file content with:
  ```typescript
  // Re-export from canonical location
  export * from "../../lib/<name>";
  ```
- **OR** if file has other functions, only replace the duplicate function:
  ```typescript
  // Remove duplicate function
  // Add import at top:
  import { <functionName> } from "../../lib/<name>";
  // Use imported function instead of local implementation
  ```

### 6. Update All Imports
- Find all files importing from original location
- Update imports to use canonical location
- Or rely on re-export shim (if file was replaced with shim)

### 7. Verify Build and Tests
```bash
npm run build
npm test
```
- If build fails: Fix import paths
- If tests fail: Review test expectations
- **DO NOT PROCEED** if build/tests fail

### 8. Commit Changes
```bash
git add <modified-files> <backup-files>
git commit -m "refactor: consolidate <function> — preserves original as backup"
```

### 9. Mark as Safe to Delete
- Update `delete_candidates.json`:
  - Add to `safe_to_delete_now` array
  - Include backup file path
  - Note re-export shim location

### 10. Apply Deletion (PROMPT 6)
- Use `apply_deletions.ps1` script
- Files will be deleted in batches
- Build/tests run after each batch

---

## Example: Consolidating `getUserWithAdditionalRoles`

**Note:** This example shows the workflow, but `getUserWithAdditionalRoles` has different signatures and cannot be consolidated as-is.

### Step 1: Identify
- Found in: `src/lib/roleUtils.ts:79` and `src/services/userService.ts:296`
- **Issue:** Different signatures - cannot consolidate directly

### Step 2: Choose Canonical
- `roleUtils.ts` version takes `PoolClient` (more flexible)
- `userService.ts` version manages connection (more convenient)

### Step 3: Create Wrapper (if consolidating)
- Create `src/lib/userRoleHelpers.ts` with both:
  - `getUserWithAdditionalRolesWithClient(client, userId, tenantId)` - canonical
  - `getUserWithAdditionalRoles(userId, tenantId)` - wrapper using `withDbClient`

### Step 4-10: Follow workflow above

---

## Current Status

### Completed Consolidations
1. ✅ `tableExists` - Partially completed
   - Canonical in `src/lib/dbHelpers.ts`
   - Duplicates removed from `platformMetricsService.ts` and `platformAuditService.ts`
   - ❌ Missing: Backup files and re-export shims
   - **Action:** Create backups and mark for deletion

### Cannot Consolidate (Different Signatures/Purposes)
1. `getUserWithAdditionalRoles` - Different signatures (client vs no-client)
2. `requireSuperuser` - Different types (function vs middleware)
3. `createTenant` - Different purposes (full setup vs simple record)

### Future Consolidations
- Review `duplicate_signatures.txt` for other candidates
- Follow this workflow for each consolidation

