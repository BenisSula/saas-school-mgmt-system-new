# Database to UI/UX Data Gap Analysis

**Date:** Phase 7.1  
**Purpose:** Identify data that exists in database but is not displayed in the frontend

---

## Executive Summary

After investigating the database schema, backend services, API endpoints, and frontend components, I've identified several data fields that exist in the database but are **not being displayed** or **not being utilized** in the frontend UI.

---

## 1. User Sessions (`shared.user_sessions`)

### Database Schema
```sql
- id
- user_id
- tenant_id ✅ (displayed)
- ip_address ✅ (displayed)
- user_agent ✅ (displayed as raw string)
- device_info ❌ (NOT DISPLAYED - JSONB with platform, os, browser)
- login_at ✅ (displayed)
- logout_at ✅ (displayed)
- expires_at ✅ (displayed)
- is_active ✅ (displayed)
- created_at ✅ (available but not prominently displayed)
- updated_at ❌ (NOT DISPLAYED)
```

### Missing Data Display

#### ❌ **`device_info` (JSONB)**
- **Database:** Contains structured device information:
  ```json
  {
    "platform": "Windows",
    "os": "Windows 10",
    "browser": "Chrome"
  }
  ```
- **Backend:** ✅ Properly mapped in `mapRowToSession()` → `deviceInfo: Record<string, unknown>`
- **Frontend:** ❌ **NOT DISPLAYED**
  - `LoginHistoryViewer.tsx` - Only shows raw `userAgent` string
  - `SessionManager.tsx` - Only shows raw `userAgent` string
  - `SessionMap.tsx` - Only extracts first word from `userAgent`
- **Impact:** Users cannot see structured device information (OS, Browser, Platform)

#### ❌ **`updated_at`**
- **Database:** ✅ Exists and updated on session changes
- **Backend:** ✅ Returned in `UserSession` interface
- **Frontend:** ❌ **NOT DISPLAYED**
- **Impact:** Cannot see when session was last updated

### Recommendations
1. **Display `deviceInfo`** in session tables:
   - Show OS, Browser, Platform as separate columns or badges
   - Parse `userAgent` if `deviceInfo` is empty (fallback)
2. **Display `updated_at`** in session details modal
3. **Enhance device display** in `SessionMap.tsx` to use `deviceInfo` instead of parsing `userAgent`

---

## 2. Login Attempts (`shared.login_attempts`)

### Database Schema
```sql
- id
- email ✅ (displayed)
- user_id ✅ (available)
- tenant_id ✅ (available)
- ip_address ✅ (displayed)
- user_agent ✅ (available but NOT displayed)
- success ✅ (displayed)
- failure_reason ✅ (displayed)
- attempted_at ✅ (displayed)
```

### Missing Data Display

#### ❌ **`user_agent`**
- **Database:** ✅ Exists
- **Backend:** ✅ Returned in `getLoginAttempts()` query
- **Frontend:** ❌ **NOT DISPLAYED**
  - `LoginAttemptsViewer.tsx` - No column for user agent
  - Component only shows: Time, Email, Status, Failure Reason, IP Address
- **Impact:** Cannot see what device/browser was used for login attempts

#### ⚠️ **No Dedicated API Endpoint**
- **Current:** `LoginAttemptsViewer.tsx` uses audit logs (`LOGIN_ATTEMPT_FAILED`, `USER_LOGIN`)
- **Problem:** Not using the dedicated `shared.login_attempts` table
- **Backend:** `getLoginAttempts()` exists but no route exposes it
- **Impact:** Missing direct access to login attempts data

### Recommendations
1. **Add `user_agent` column** to `LoginAttemptsViewer.tsx` table
2. **Create API endpoint** `/superuser/login-attempts` using `getLoginAttempts()` service
3. **Update `LoginAttemptsViewer.tsx`** to use dedicated endpoint instead of audit logs
4. **Add device info parsing** similar to sessions

---

## 3. Password Change History (`shared.password_change_history`)

### Database Schema
```sql
- id
- user_id ✅ (available)
- tenant_id ✅ (available)
- changed_by ✅ (displayed as "Admin" or "Self")
- change_type ✅ (displayed)
- ip_address ✅ (displayed)
- user_agent ✅ (displayed)
- changed_at ✅ (displayed)
- metadata ❌ (NOT DISPLAYED - JSONB with reason, notification sent, etc.)
```

### Missing Data Display

#### ❌ **`metadata` (JSONB)**
- **Database:** Contains additional context:
  ```json
  {
    "reason": "Security incident",
    "temporaryPassword": true,
    "notificationSent": true
  }
  ```
- **Backend:** ✅ Properly mapped → `metadata: Record<string, unknown>`
- **Frontend:** ❌ **NOT DISPLAYED**
  - `PasswordHistoryViewer.tsx` - No metadata column
  - Only shows: Time, Type, Changed By, IP, Device
- **Impact:** Cannot see reason for password change or notification status

#### ⚠️ **`changed_by` Display Limitation**
- **Current:** Shows "Admin" or "Self" (boolean check)
- **Database:** Contains UUID of admin who changed it
- **Frontend:** ❌ **NOT DISPLAYED** - Should show admin email/name
- **Impact:** Cannot identify which admin performed the change

### Recommendations
1. **Display `metadata.reason`** in password history table
2. **Show `changed_by` details** - Resolve UUID to admin email/name
3. **Add metadata column** or expandable row to show full metadata
4. **Show notification status** from metadata

---

## 4. Audit Logs (`shared.audit_logs`)

### Database Schema
```sql
- id ✅
- tenant_id ✅ (available)
- user_id ✅ (available)
- action ✅ (displayed)
- resource_type ✅ (displayed)
- resource_id ✅ (displayed)
- details ✅ (partially displayed - JSONB)
- ip_address ✅ (displayed)
- user_agent ❌ (NOT DISPLAYED)
- request_id ❌ (NOT DISPLAYED)
- severity ✅ (displayed)
- tags ✅ (available but NOT displayed)
- created_at ✅ (displayed)
```

### Missing Data Display

#### ❌ **`user_agent`**
- **Database:** ✅ Exists
- **Backend:** ✅ Returned in `AuditLogEntry` interface
- **Frontend:** ❌ **NOT DISPLAYED**
  - `PlatformAuditLogViewer.tsx` - No user agent column
- **Impact:** Cannot see device/browser used for audit events

#### ❌ **`request_id`**
- **Database:** ✅ Exists (for request tracing)
- **Backend:** ✅ Returned in `AuditLogEntry` interface
- **Frontend:** ❌ **NOT DISPLAYED**
- **Impact:** Cannot trace requests across logs

#### ❌ **`tags`**
- **Database:** ✅ Exists (array of tags like ['security', 'authentication'])
- **Backend:** ✅ Returned in `AuditLogEntry` interface
- **Frontend:** ❌ **NOT DISPLAYED**
  - Available for filtering but not shown in table
- **Impact:** Cannot see categorization tags

#### ⚠️ **`details` (JSONB)**
- **Database:** ✅ Contains structured event details
- **Backend:** ✅ Returned as `details: Record<string, unknown>`
- **Frontend:** ⚠️ **PARTIALLY DISPLAYED**
  - Only searched, not shown in table columns
  - Should be expandable or shown in detail view
- **Impact:** Limited visibility into event details

### Recommendations
1. **Add `user_agent` column** to audit log table
2. **Add `tags` display** as badges/chips in table
3. **Add `request_id`** column (or in detail view)
4. **Expand `details`** - Show in expandable row or detail modal
5. **Add detail view modal** for full audit log entry

---

## 5. Investigation Cases (`shared.investigation_cases`)

### Database Schema
```sql
- id
- case_number ✅
- title ✅
- description ✅
- status ✅
- priority ✅
- case_type ✅
- related_user_id ✅
- related_tenant_id ✅
- assigned_to ✅
- created_by ✅
- resolved_by ❌ (NOT DISPLAYED - frontend doesn't exist)
- opened_at ✅
- investigated_at ❌ (NOT DISPLAYED - frontend doesn't exist)
- resolved_at ❌ (NOT DISPLAYED - frontend doesn't exist)
- closed_at ❌ (NOT DISPLAYED - frontend doesn't exist)
- resolution ❌ (NOT DISPLAYED - frontend doesn't exist)
- resolution_notes ❌ (NOT DISPLAYED - frontend doesn't exist)
- tags ✅
- metadata ❌ (NOT DISPLAYED - frontend doesn't exist)
```

### Missing Data Display

#### ❌ **Entire Investigation UI Missing**
- **Backend:** ✅ Fully implemented
- **Frontend:** ❌ **NO UI COMPONENTS**
- **Impact:** Investigation tools are completely inaccessible

### Recommendations
1. **Create investigation UI** (highest priority)
2. **Display all case fields** when UI is created
3. **Show timeline** (opened_at → investigated_at → resolved_at → closed_at)
4. **Display resolution details** (resolution, resolution_notes)

---

## 6. Platform Overview / Dashboard

### Missing Data Display

#### ❌ **Active Sessions Count**
- **Database:** ✅ Can be queried from `shared.user_sessions`
- **Backend:** ✅ `getPlatformActiveSessions()` exists
- **Frontend:** ⚠️ **ESTIMATED** - Dashboard shows `overview.totals.users * 1.2`
- **Impact:** Not showing real active session count

#### ❌ **Failed Login Attempts Count**
- **Database:** ✅ Can be queried from `shared.login_attempts`
- **Backend:** ✅ `getLoginAttempts()` exists
- **Frontend:** ❌ **NOT DISPLAYED** on dashboard
- **Impact:** No quick view of security issues

#### ❌ **Tenant-Specific Metrics**
- **Database:** ✅ Tenant data available
- **Frontend:** ⚠️ **PARTIALLY DISPLAYED**
  - Some tenant info shown but not comprehensive
- **Impact:** Limited tenant insights

### Recommendations
1. **Use real active sessions** instead of estimate
2. **Add failed login attempts** widget to dashboard
3. **Add tenant breakdown** metrics

---

## Summary of Missing Data

### High Priority (Critical for UX)

1. **`device_info` in Sessions** - Structured device information not displayed
2. **`user_agent` in Login Attempts** - Device info missing
3. **`metadata` in Password History** - Reason and context missing
4. **`tags` in Audit Logs** - Categorization not visible
5. **Investigation Tools UI** - Complete feature missing

### Medium Priority (Nice to Have)

6. **`user_agent` in Audit Logs** - Device info missing
7. **`request_id` in Audit Logs** - Request tracing missing
8. **`details` expansion** - Full event details not shown
9. **`changed_by` resolution** - Admin name/email not shown
10. **Real active sessions count** - Currently estimated

### Low Priority (Enhancement)

11. **`updated_at` in Sessions** - Last update time
12. **`resolved_by` in Cases** - When UI is created
13. **Tenant breakdown metrics** - More detailed analytics

---

## Code Changes Required

### Backend (Minor)

1. **Add login attempts endpoint:**
   ```typescript
   // backend/src/routes/superuser/audit.ts or new file
   router.get('/login-attempts', ...) // Use getLoginAttempts()
   ```

2. **Enhance user resolution:**
   ```typescript
   // Resolve changed_by UUIDs to user emails/names
   // Add JOIN to shared.users in password history query
   ```

### Frontend (Major)

1. **Update `LoginHistoryViewer.tsx`:**
   - Add `deviceInfo` column showing OS, Browser, Platform
   - Add `updated_at` in detail view

2. **Update `SessionManager.tsx`:**
   - Display `deviceInfo` instead of raw `userAgent`
   - Show structured device information

3. **Update `LoginAttemptsViewer.tsx`:**
   - Add `user_agent` column
   - Switch to dedicated `/superuser/login-attempts` endpoint
   - Parse and display device info

4. **Update `PasswordHistoryViewer.tsx`:**
   - Add `metadata.reason` column
   - Resolve and display `changed_by` admin email/name
   - Show notification status

5. **Update `PlatformAuditLogViewer.tsx`:**
   - Add `user_agent` column
   - Add `tags` badges/chips
   - Add `request_id` column (or detail view)
   - Expand `details` in expandable row

6. **Update `SessionMap.tsx`:**
   - Use `deviceInfo` instead of parsing `userAgent`
   - Show structured device information

7. **Create Investigation UI:**
   - Build investigation cases page
   - Display all case fields
   - Show timeline and resolution details

8. **Update Dashboard:**
   - Use real active sessions count
   - Add failed login attempts widget

---

## Testing Checklist

After implementing changes:

- [ ] Verify `device_info` displays correctly in session tables
- [ ] Verify `user_agent` displays in login attempts
- [ ] Verify `metadata` displays in password history
- [ ] Verify `tags` display in audit logs
- [ ] Verify login attempts endpoint works
- [ ] Verify `changed_by` resolves to admin names
- [ ] Verify real active sessions count on dashboard
- [ ] Test investigation tools UI (once created)

---

## Conclusion

**Total Missing Fields:** 15+ data points  
**Critical Missing Features:** Investigation Tools UI  
**Estimated Impact:** Medium-High (affects user experience and data visibility)

The database contains rich data that is not being fully utilized in the frontend. Most critical is the complete absence of investigation tools UI, followed by missing device information display and metadata fields.

