# Generic Tenant Scripts - Scalable Solution

## Overview
All tenant-specific scripts have been replaced with **generic, reusable scripts** that work for **any tenant/school**. This ensures scalability and maintainability.

---

## Available Scripts

### 1. `verifyTenantData.ts` - Verify Tenant Data
**Purpose:** Verify tenant setup and data for any school/tenant

**Usage:**
```bash
npm run verify:tenant <tenant-identifier> [admin-email]
```

**Examples:**
```bash
# By tenant name
npm run verify:tenant "New Horizon Senior Secondary School"
npm run verify:tenant "St. Peter's Senior Secondary School"

# By schema name
npm run verify:tenant tenant_new_horizon_senior_secondary_school
npm run verify:tenant tenant_st_peters_senior_secondary_school

# By tenant ID
npm run verify:tenant d757e5b4-4753-474d-9a9c-a4e6d74496a5

# With admin email verification
npm run verify:tenant "New Horizon Senior Secondary School" fatou.jallow@newhorizon.edu.gm
```

**What it does:**
- Finds tenant by name, schema_name, or ID
- Verifies admin user (if email provided)
- Counts users, teachers, students, classes
- Checks for HODs
- Verifies school record exists
- Provides summary and recommendations

---

### 2. `fixTenantAdmin.ts` - Fix Tenant Admin Setup
**Purpose:** Fix admin user setup for any tenant

**Usage:**
```bash
npm run fix:tenant-admin <tenant-identifier> <admin-email> [admin-password]
```

**Examples:**
```bash
# Fix admin with password update
npm run fix:tenant-admin "New Horizon Senior Secondary School" fatou.jallow@newhorizon.edu.gm NhsAdmin@2025

# Fix admin without password update (only fixes tenant_id and status)
npm run fix:tenant-admin tenant_st_peters_senior_secondary_school admin@stpeters.edu.gm

# Create new admin user (requires password)
npm run fix:tenant-admin d757e5b4-4753-474d-9a9c-a4e6d74496a5 newadmin@school.edu.gm NewPassword@2025
```

**What it does:**
- Finds tenant by name, schema_name, or ID
- Finds or creates admin user
- Fixes `tenant_id` if mismatched
- Ensures admin is `active` and `verified`
- Updates password if provided
- Verifies tenant schema has data

---

## Why Generic Scripts?

### ❌ Old Approach (Not Scalable)
```typescript
// fixNewHorizonAdmin.ts - Only works for New Horizon
const TENANT_NAME = 'New Horizon Senior Secondary School';
const ADMIN_EMAIL = 'fatou.jallow@newhorizon.edu.gm';
// ... hardcoded values
```

**Problems:**
- Need separate file for each school
- Hardcoded values
- Not reusable
- Maintenance nightmare as schools scale

### ✅ New Approach (Scalable)
```typescript
// fixTenantAdmin.ts - Works for ANY tenant
async function fixTenantAdmin(options: {
  tenantIdentifier: string; // Flexible: name, schema, or ID
  adminEmail: string;
  adminPassword?: string;
})
```

**Benefits:**
- ✅ Single script for all tenants
- ✅ Accepts parameters
- ✅ Works with tenant name, schema name, or tenant ID
- ✅ Reusable and maintainable
- ✅ Scales to any number of schools

---

## Migration Guide

### Old Commands → New Commands

| Old Command | New Command |
|------------|-------------|
| `npm run verify:newhorizon` | `npm run verify:tenant "New Horizon Senior Secondary School"` |
| `npm run fix:newhorizon-admin` | `npm run fix:tenant-admin "New Horizon Senior Secondary School" fatou.jallow@newhorizon.edu.gm NhsAdmin@2025` |

### For Other Schools

**St. Peter's School:**
```bash
npm run verify:tenant "St. Peter's Senior Secondary School"
npm run fix:tenant-admin "St. Peter's Senior Secondary School" lamin.sowe@stpeterslamin.edu.gm StPetersAdmin@2025
```

**Daddy Jobe School:**
```bash
npm run verify:tenant "Daddy Jobe Comprehensive Senior Secondary School"
npm run fix:tenant-admin "Daddy Jobe Comprehensive Senior Secondary School" musu.bah@daddyjobe.edu.gm DaddyJobeAdmin@2025
```

---

## Implementation Details

### Tenant Identifier Resolution
The scripts accept tenant identifier in multiple formats:

1. **Tenant Name:** `"New Horizon Senior Secondary School"`
2. **Schema Name:** `tenant_new_horizon_senior_secondary_school`
3. **Tenant ID:** `d757e5b4-4753-474d-9a9c-a4e6d74496a5`

The scripts query `shared.tenants` table with:
```sql
SELECT id, schema_name, name FROM shared.tenants 
WHERE name = $1 OR schema_name = $1 OR id::text = $1
```

### Error Handling
- If tenant not found, lists all available tenants
- If admin not found and no password provided, shows error
- Provides helpful error messages and suggestions

---

## Best Practices

### 1. Use Tenant Name for Readability
```bash
npm run verify:tenant "New Horizon Senior Secondary School"
```

### 2. Use Schema Name for Automation
```bash
npm run fix:tenant-admin tenant_new_horizon_senior_secondary_school admin@school.edu.gm
```

### 3. Use Tenant ID for Scripts
```bash
npm run verify:tenant d757e5b4-4753-474d-9a9c-a4e6d74496a5
```

### 4. Always Verify Before Fixing
```bash
# First verify
npm run verify:tenant "School Name" admin@school.edu.gm

# Then fix if needed
npm run fix:tenant-admin "School Name" admin@school.edu.gm Password@2025
```

---

## Scripts Removed

The following school-specific scripts have been **removed** and replaced with generic versions:

- ❌ `fixNewHorizonAdmin.ts` → ✅ `fixTenantAdmin.ts`
- ❌ `verifyAndSyncNewHorizon.ts` → ✅ `verifyTenantData.ts`

---

## Summary

✅ **Scalable:** Works for any number of schools/tenants  
✅ **Reusable:** Single script for all tenants  
✅ **Flexible:** Accepts tenant name, schema, or ID  
✅ **Maintainable:** No hardcoded values  
✅ **Future-proof:** Easy to extend for new features  

All tenant operations are now handled through generic, parameterized scripts that scale with your business.

