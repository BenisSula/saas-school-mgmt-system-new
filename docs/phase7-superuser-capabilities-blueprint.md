# PHASE 7 — SUPERUSER/OWNER CAPABILITY INTEGRATION BLUEPRINT

**Date:** 2025-01-XX  
**Status:** Blueprint Complete  
**Branch:** `fix/superuser-flow-validation`

---

## EXECUTIVE SUMMARY

This document provides a comprehensive UX blueprint, backend endpoint design, frontend route structure, and permissions extension plan for expanding SuperUser/Owner capabilities. The blueprint ensures all 14 required capabilities are integrated while maintaining engineering principles, security, and multi-tenant isolation.

---

## 1. CURRENT STATE ANALYSIS

### 1.1 Existing SuperUser Capabilities

**Backend Endpoints (Already Implemented):**
- ✅ `GET /superuser/overview` - Platform overview
- ✅ `GET /superuser/schools` - List all schools
- ✅ `POST /superuser/schools` - Create school tenant
- ✅ `PATCH /superuser/schools/:id` - Update school
- ✅ `DELETE /superuser/schools/:id` - Soft delete school
- ✅ `POST /superuser/schools/:id/admins` - Create admin for school
- ✅ `GET /superuser/users` - List all platform users
- ✅ `PATCH /superuser/users/:userId/status` - Update user status
- ✅ `GET /superuser/audit-logs` - Platform-wide audit logs
- ✅ `GET /superuser/login-attempts` - Login attempts monitoring
- ✅ `GET /superuser/sessions` - Active sessions monitoring
- ✅ `POST /superuser/users/:userId/reset-password` - Reset password
- ✅ `POST /superuser/users/:userId/change-password` - Change password
- ✅ `GET /superuser/users/:userId/password-history` - Password history
- ✅ `GET /superuser/analytics/tenant/:tenantId` - Tenant analytics
- ✅ `GET /superuser/usage` - Usage monitoring
- ✅ `POST /superuser/reports` - Generate reports
- ✅ `PUT /superuser/settings` - Platform settings
- ✅ `POST /superuser/investigations/cases` - Create investigation case
- ✅ `GET /superuser/investigations/cases` - List investigation cases
- ✅ `GET /superuser/investigations/cases/:caseId` - Get case details

**Frontend Pages (Already Implemented):**
- ✅ `SuperuserOverviewPage` - Platform overview dashboard
- ✅ `SuperuserManageSchoolsPage` - School management
- ✅ `SuperuserUsersPage` - User management
- ✅ `SuperuserSubscriptionsPage` - Subscription management
- ✅ `SuperuserReportsPage` - Reports
- ✅ `SuperuserSettingsPage` - Platform settings
- ✅ `SuperuserTenantAnalyticsPage` - Tenant analytics
- ✅ `SuperuserUsageMonitoringPage` - Usage monitoring
- ✅ `SuperuserActivityPage` - Activity logs
- ✅ `InvestigationListPage` - Investigation cases list
- ✅ `InvestigationDetailPage` - Case details
- ✅ `InvestigationCreatePage` - Create case

**Permissions (Already Implemented):**
- ✅ `tenants:manage` - Superadmin only
- ✅ `users:manage` - Superadmin + Admin
- ✅ `reports:manage` - Superadmin only

### 1.2 Gaps Identified

**Missing Capabilities:**
1. ❌ **School-level audit logs** - Currently only platform-wide
2. ❌ **Subscription status modification** - UI exists but backend may need enhancement
3. ❌ **Manual override tools** - No explicit override mechanisms
4. ❌ **Role hierarchy restrictions** - Not explicitly enforced in UI
5. ❌ **Permission propagation visualization** - No UI to show permission flow

**Partially Implemented:**
1. ⚠️ **User enable/disable** - Status update exists but needs better UX
2. ⚠️ **Password reset** - Exists but needs better integration
3. ⚠️ **Global usage analytics** - Basic exists, needs expansion
4. ⚠️ **Platform-wide reporting** - Basic exists, needs more report types

---

## 2. UX BLUEPRINT

### 2.1 Navigation Structure

```
SuperUser Dashboard
├── Overview (existing)
├── Schools
│   ├── List Schools (existing)
│   ├── Create School (existing)
│   ├── School Details
│   │   ├── Basic Info
│   │   ├── Subscription Management (NEW)
│   │   ├── Admin Accounts (existing)
│   │   ├── Tenant Analytics (existing)
│   │   ├── Audit Logs (NEW - school-level)
│   │   └── Manual Overrides (NEW)
│   └── School Settings
├── Users
│   ├── All Users (existing)
│   ├── User Details
│   │   ├── Profile
│   │   ├── Roles & Permissions (NEW - visualization)
│   │   ├── Activity Timeline (existing)
│   │   ├── Sessions (existing)
│   │   ├── Password Management (existing)
│   │   └── Manual Actions (NEW)
│   └── Bulk Actions (NEW)
├── Audit & Monitoring
│   ├── Platform Audit Logs (existing)
│   ├── School Audit Logs (NEW)
│   ├── Login Activity (existing)
│   └── Anomaly Detection (existing)
├── Analytics & Reports
│   ├── Platform Analytics (existing)
│   ├── Usage Monitoring (existing)
│   ├── Generate Reports (existing)
│   └── Custom Reports (NEW)
├── Investigations (existing)
└── Settings
    ├── Platform Settings (existing)
    ├── Feature Flags (existing)
    ├── Role Permissions Matrix (NEW)
    └── Security Policies (NEW)
```

### 2.2 Key UX Flows

#### 2.2.1 School Creation Flow

**Current Flow:**
1. Navigate to Schools → Create School
2. Fill form (name, domain, contact info)
3. Submit → School created
4. Optionally create admin

**Enhanced Flow:**
1. Navigate to Schools → Create School
2. Fill form:
   - Basic Info (name, domain, contact)
   - Subscription Tier (free/trial/paid) ← NEW
   - Initial Admin Account (optional)
   - Custom Schema Name (optional)
3. Submit → School created with subscription
4. Show success modal with:
   - School ID
   - Schema name
   - Admin credentials (if created)
   - Next steps (invite admin, configure settings)
5. Redirect to School Details page

**UX Components:**
- `CreateSchoolModal` - Enhanced with subscription selection
- `SchoolCreatedSuccessModal` - Shows credentials and next steps
- `SchoolDetailsPage` - New comprehensive school management page

#### 2.2.2 Subscription Management Flow

**Current State:** Basic subscription display exists

**Enhanced Flow:**
1. Navigate to Schools → Select School → Subscription tab
2. View current subscription:
   - Tier (free/trial/paid)
   - Status (active/suspended/cancelled)
   - Billing period
   - Usage limits
   - Next billing date
3. Actions available:
   - Upgrade/Downgrade tier
   - Suspend subscription
   - Resume subscription
   - Cancel subscription
   - Extend trial period
   - Set custom limits
4. Confirmation modal for destructive actions
5. Audit log entry created automatically

**UX Components:**
- `SubscriptionManagementCard` - Display current subscription
- `SubscriptionChangeModal` - Change tier/status
- `SubscriptionHistoryTimeline` - Show subscription changes
- `UsageLimitsEditor` - Set custom limits per tenant

#### 2.2.3 User Management Flow

**Current Flow:**
1. Navigate to Users → View list
2. Filter/search users
3. Click user → View details modal
4. Update status or reset password

**Enhanced Flow:**
1. Navigate to Users → View list
2. Filter/search users:
   - By tenant
   - By role
   - By status
   - By activity date
3. Click user → Navigate to User Details page
4. User Details page tabs:
   - **Overview**: Basic info, status, roles
   - **Roles & Permissions**: Visual permission matrix ← NEW
   - **Activity**: Timeline of actions
   - **Sessions**: Active sessions, login history
   - **Password**: Reset/change password
   - **Manual Actions**: Override actions ← NEW
5. Bulk actions:
   - Enable/disable multiple users
   - Reset passwords (bulk)
   - Export user list

**UX Components:**
- `UserDetailsPage` - Comprehensive user management
- `PermissionMatrixViewer` - Visual permission display ← NEW
- `BulkUserActionsModal` - Bulk operations ← NEW
- `ManualOverrideModal` - Override actions ← NEW

#### 2.2.4 Audit Logs Flow

**Current Flow:**
1. Navigate to Activity → View platform-wide logs
2. Filter by date, user, action
3. View details in modal

**Enhanced Flow:**
1. Navigate to Audit & Monitoring
2. Select scope:
   - **Platform-wide** (existing)
   - **School-specific** ← NEW
   - **User-specific** (existing)
3. Apply filters:
   - Date range
   - Action type
   - Severity
   - Tenant (for platform-wide)
   - User
   - Resource type
4. View results in table
5. Click entry → View details modal
6. Export options:
   - CSV
   - JSON
   - PDF report

**UX Components:**
- `AuditLogViewer` - Enhanced with school filtering
- `SchoolAuditLogPage` - Dedicated school audit logs ← NEW
- `AuditLogDetailsModal` - Detailed view
- `AuditLogExportModal` - Export options

#### 2.2.5 Role Hierarchy & Permissions Flow

**Current State:** Permissions exist but not visualized

**Enhanced Flow:**
1. Navigate to Settings → Role Permissions Matrix
2. View matrix:
   - Rows: Roles (Superadmin, Admin, HOD, Teacher, Student)
   - Columns: Permissions
   - Cells: Checkmarks showing which roles have which permissions
3. Visual indicators:
   - Inherited permissions (from parent role)
   - Direct permissions
   - Restricted permissions
4. Edit mode (SuperUser only):
   - Add/remove permissions per role
   - See impact analysis (which users affected)
   - Confirm changes
5. Permission propagation visualization:
   - Show how permissions flow top → bottom
   - Highlight restrictions (e.g., Admin cannot modify Superadmin)

**UX Components:**
- `RolePermissionsMatrixPage` - Visual matrix ← NEW
- `PermissionPropagationDiagram` - Flow visualization ← NEW
- `PermissionImpactAnalysis` - Show affected users ← NEW

#### 2.2.6 Manual Override Tools Flow

**Current State:** Not explicitly implemented

**Enhanced Flow:**
1. Navigate to School Details → Manual Overrides tab
2. Available override actions:
   - **Force unlock user account** (bypass lockout)
   - **Bypass tenant restrictions** (temporary)
   - **Override subscription limits** (temporary)
   - **Force password change** (bypass policy)
   - **Restore deleted data** (from audit logs)
3. For each action:
   - Show current state
   - Enter reason for override
   - Set expiration (if temporary)
   - Confirm action
4. All overrides:
   - Logged in audit with severity 'critical'
   - Visible in override history
   - Can be revoked

**UX Components:**
- `ManualOverridePanel` - Override actions ← NEW
- `OverrideHistoryTable` - Show override history ← NEW
- `OverrideConfirmationModal` - Confirm override ← NEW

---

## 3. BACKEND ENDPOINTS REQUIRED

### 3.1 School Management Endpoints

**Existing (No Changes Needed):**
- ✅ `GET /superuser/schools` - List schools
- ✅ `POST /superuser/schools` - Create school
- ✅ `PATCH /superuser/schools/:id` - Update school
- ✅ `DELETE /superuser/schools/:id` - Delete school
- ✅ `POST /superuser/schools/:id/admins` - Create admin

**New/Enhanced Endpoints:**

```typescript
// School Details
GET /superuser/schools/:id
  - Returns comprehensive school info including subscription, stats, etc.

// Subscription Management
PATCH /superuser/schools/:id/subscription
  Body: { tier, status, customLimits?, trialEndDate? }
  - Update subscription tier/status
  - Set custom usage limits
  - Extend trial period

GET /superuser/schools/:id/subscription/history
  - Returns subscription change history

// School-level Audit Logs
GET /superuser/schools/:id/audit-logs
  Query: { startDate?, endDate?, action?, severity?, limit?, offset? }
  - Returns audit logs for specific school only

// Manual Overrides
POST /superuser/schools/:id/overrides
  Body: { action, reason, expiresAt?, metadata? }
  - Create manual override
  Actions: 'unlock_accounts', 'bypass_limits', 'restore_data', etc.

GET /superuser/schools/:id/overrides
  - List active overrides for school

DELETE /superuser/schools/:id/overrides/:overrideId
  - Revoke override
```

### 3.2 User Management Endpoints

**Existing (No Changes Needed):**
- ✅ `GET /superuser/users` - List users
- ✅ `PATCH /superuser/users/:userId/status` - Update status
- ✅ `POST /superuser/users/:userId/reset-password` - Reset password
- ✅ `POST /superuser/users/:userId/change-password` - Change password
- ✅ `GET /superuser/users/:userId/password-history` - Password history
- ✅ `GET /superuser/users/:userId/login-history` - Login history
- ✅ `GET /superuser/users/:userId/sessions` - Active sessions
- ✅ `POST /superuser/users/:userId/sessions/:sessionId/revoke` - Revoke session
- ✅ `POST /superuser/users/:userId/sessions/revoke-all` - Revoke all sessions

**New/Enhanced Endpoints:**

```typescript
// User Details
GET /superuser/users/:userId
  - Returns comprehensive user info including roles, permissions, activity summary

// Roles & Permissions
GET /superuser/users/:userId/permissions
  - Returns effective permissions (including inherited from roles)
  - Shows permission source (role, additional_role, override)

PATCH /superuser/users/:userId/permissions
  Body: { permissions: Permission[], reason }
  - Override user permissions (SuperUser only)
  - Creates audit log with severity 'critical'

// Bulk Actions
POST /superuser/users/bulk/status
  Body: { userIds: string[], status: UserStatus, reason }
  - Update status for multiple users

POST /superuser/users/bulk/reset-password
  Body: { userIds: string[], reason }
  - Reset passwords for multiple users
  - Returns array of { userId, temporaryPassword }

// Manual Overrides
POST /superuser/users/:userId/overrides
  Body: { action, reason, expiresAt?, metadata? }
  Actions: 'force_unlock', 'bypass_restrictions', 'force_password_change', etc.

GET /superuser/users/:userId/overrides
  - List active overrides for user
```

### 3.3 Audit & Monitoring Endpoints

**Existing (No Changes Needed):**
- ✅ `GET /superuser/audit-logs` - Platform audit logs
- ✅ `GET /superuser/login-attempts` - Login attempts
- ✅ `GET /superuser/sessions` - Active sessions

**New/Enhanced Endpoints:**

```typescript
// School-level Audit Logs
GET /superuser/audit-logs/school/:schoolId
  Query: { startDate?, endDate?, action?, severity?, limit?, offset? }
  - Returns audit logs filtered by school/tenant

// Enhanced Audit Log Export
GET /superuser/audit-logs/export
  Query: { format: 'csv' | 'json' | 'pdf', schoolId?, ...filters }
  - Export audit logs with school filtering support

// Audit Log Statistics
GET /superuser/audit-logs/stats
  Query: { schoolId?, startDate?, endDate? }
  - Returns statistics: total logs, by severity, by action type, etc.
```

### 3.4 Analytics & Reports Endpoints

**Existing (No Changes Needed):**
- ✅ `GET /superuser/overview` - Platform overview
- ✅ `GET /superuser/analytics/tenant/:tenantId` - Tenant analytics
- ✅ `GET /superuser/usage` - Usage monitoring
- ✅ `POST /superuser/reports` - Generate reports

**New/Enhanced Endpoints:**

```typescript
// Enhanced Platform Analytics
GET /superuser/analytics/platform
  Query: { startDate?, endDate?, groupBy?: 'day' | 'week' | 'month' }
  - Returns time-series analytics for platform
  - Includes: user growth, activity trends, subscription metrics

// Custom Report Builder
POST /superuser/reports/custom
  Body: { name, dataSource, filters, columns, format }
  - Create custom report definition

GET /superuser/reports/custom/:reportId/execute
  Query: { parameters? }
  - Execute custom report

// Report Templates
GET /superuser/reports/templates
  - List available report templates

POST /superuser/reports/templates/:templateId/generate
  Body: { parameters }
  - Generate report from template
```

### 3.5 Role & Permission Management Endpoints

**New Endpoints:**

```typescript
// Role Permissions Matrix
GET /superuser/roles/permissions
  - Returns complete role-permission matrix
  - Shows which permissions each role has

PATCH /superuser/roles/:role/permissions
  Body: { permissions: Permission[], reason }
  - Update permissions for a role
  - Creates audit log
  - Shows impact analysis (affected users)

GET /superuser/roles/:role/permissions/impact
  Query: { proposedPermissions: Permission[] }
  - Returns impact analysis: how many users affected, what changes

// Permission Propagation
GET /superuser/permissions/propagation
  - Returns permission propagation diagram data
  - Shows hierarchy: Superadmin → Admin → HOD → Teacher → Student

// User Permission Analysis
GET /superuser/users/:userId/permissions/analysis
  - Returns detailed permission analysis:
    - Direct permissions (from role)
    - Inherited permissions (from additional_roles)
    - Effective permissions (union)
    - Restricted permissions (cannot access)
```

### 3.6 Manual Override Endpoints

**New Endpoints:**

```typescript
// Platform Overrides
POST /superuser/overrides
  Body: { type, targetId, action, reason, expiresAt?, metadata? }
  Types: 'user', 'school', 'platform'
  Actions: 'unlock_account', 'bypass_limits', 'restore_data', etc.

GET /superuser/overrides
  Query: { type?, targetId?, active?: boolean }
  - List all overrides

DELETE /superuser/overrides/:overrideId
  - Revoke override

// Override History
GET /superuser/overrides/history
  Query: { type?, targetId?, startDate?, endDate? }
  - Returns override history with audit trail
```

---

## 4. FRONTEND ROUTES REQUIRED

### 4.1 Existing Routes (No Changes)

**Current Routes:**
- ✅ `/dashboard/superuser/overview` - Overview
- ✅ `/dashboard/superuser/schools` - Schools list
- ✅ `/dashboard/superuser/users` - Users list
- ✅ `/dashboard/superuser/subscriptions` - Subscriptions
- ✅ `/dashboard/superuser/analytics` - Tenant analytics
- ✅ `/dashboard/superuser/usage` - Usage monitoring
- ✅ `/dashboard/superuser/reports` - Reports
- ✅ `/dashboard/superuser/settings` - Settings
- ✅ `/dashboard/superuser/activity` - Activity logs
- ✅ `/dashboard/superuser/investigations` - Investigations list
- ✅ `/dashboard/superuser/investigations/create` - Create case
- ✅ `/dashboard/superuser/investigations/:caseId` - Case details
- ✅ `/dashboard/superuser/users/:userId/activity` - User activity

### 4.2 New Routes Required

```typescript
// School Management
/dashboard/superuser/schools/:schoolId
  - School details page with tabs:
    - Overview
    - Subscription
    - Admins
    - Analytics
    - Audit Logs (NEW)
    - Manual Overrides (NEW)

/dashboard/superuser/schools/:schoolId/subscription
  - Subscription management page

/dashboard/superuser/schools/:schoolId/audit-logs
  - School-level audit logs page

// User Management
/dashboard/superuser/users/:userId
  - User details page with tabs:
    - Overview
    - Roles & Permissions (NEW)
    - Activity
    - Sessions
    - Password
    - Manual Actions (NEW)

/dashboard/superuser/users/:userId/permissions
  - Permission visualization page

// Audit & Monitoring
/dashboard/superuser/audit
  - Audit logs hub with scope selector:
    - Platform-wide
    - School-specific
    - User-specific

/dashboard/superuser/audit/school/:schoolId
  - School audit logs page

// Role & Permissions
/dashboard/superuser/settings/roles
  - Role permissions matrix page

/dashboard/superuser/settings/permissions
  - Permission propagation visualization

// Manual Overrides
/dashboard/superuser/overrides
  - Override management page

/dashboard/superuser/overrides/history
  - Override history page
```

---

## 5. PERMISSIONS EXTENSION PLAN

### 5.1 New Permissions Required

```typescript
// Add to Permission type
export type Permission =
  // ... existing permissions ...
  | 'subscriptions:manage'        // Manage subscription tiers/status
  | 'subscriptions:view'          // View subscription details
  | 'audit:view_school'           // View school-level audit logs
  | 'overrides:create'            // Create manual overrides
  | 'overrides:view'              // View override history
  | 'roles:manage'                // Modify role permissions
  | 'roles:view'                  // View role permissions matrix
  | 'reports:custom'              // Create custom reports
  | 'analytics:platform'          // View platform-wide analytics
```

### 5.2 Updated Role Permissions

```typescript
export const rolePermissions: Record<Role, Permission[]> = {
  // ... existing roles ...
  
  superadmin: [
    // ... existing permissions ...
    'subscriptions:manage',
    'subscriptions:view',
    'audit:view_school',
    'overrides:create',
    'overrides:view',
    'roles:manage',
    'roles:view',
    'reports:custom',
    'analytics:platform'
  ]
};
```

### 5.3 Permission Hierarchy Rules

**Restriction Rules:**
1. **SuperUser cannot modify own permissions** - Prevents lockout
2. **SuperUser cannot delete own account** - Prevents platform lockout
3. **SuperUser cannot modify SuperUser role permissions** - Prevents privilege escalation
4. **Admin cannot modify SuperUser accounts** - Enforced in backend
5. **Admin cannot modify Admin accounts** - Only SuperUser can modify admins
6. **HOD cannot modify Admin accounts** - Enforced in backend
7. **Teacher cannot modify any accounts** - Enforced in backend

**Permission Propagation Rules:**
1. **Top → Bottom inheritance:**
   - SuperUser permissions → Admin permissions (subset)
   - Admin permissions → HOD permissions (subset)
   - HOD permissions → Teacher permissions (subset)
   - Teacher permissions → Student permissions (subset)

2. **Additional roles:**
   - HOD is additional role on Teacher
   - HOD inherits Teacher permissions + HOD-specific permissions
   - Cannot have permissions beyond Admin level

3. **Override permissions:**
   - SuperUser can override any permission for any user
   - Overrides are temporary (with expiration) or permanent
   - All overrides logged with severity 'critical'

### 5.4 Permission Check Middleware

**New Middleware Functions:**

```typescript
// backend/src/middleware/rbac.ts

/**
 * Requires SuperUser role (superadmin)
 * Prevents SuperUser from modifying own account
 */
export function requireSuperuser(allowSelfModification = false) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ message: 'SuperUser access required' });
    }
    
    // Prevent self-modification unless explicitly allowed
    if (!allowSelfModification && req.params.userId === req.user.id) {
      return res.status(403).json({ message: 'Cannot modify own account' });
    }
    
    return next();
  };
}

/**
 * Enforces role hierarchy restrictions
 * Prevents lower roles from modifying higher roles
 */
export function enforceRoleHierarchy(targetRole: Role, actorRole: Role): boolean {
  const hierarchy: Record<Role, number> = {
    superadmin: 5,
    admin: 4,
    hod: 3,
    teacher: 2,
    student: 1
  };
  
  return hierarchy[actorRole] >= hierarchy[targetRole];
}

/**
 * Requires permission with role hierarchy check
 */
export function requirePermissionWithHierarchy(
  permission: Permission,
  targetUserId?: string
) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Check permission
    if (!hasPermission(req.user?.role, permission)) {
      return res.status(403).json({ message: 'Permission denied' });
    }
    
    // Check role hierarchy if modifying user
    if (targetUserId && req.params.userId) {
      // Fetch target user role
      const targetUser = await getUserById(req.params.userId);
      if (targetUser && !enforceRoleHierarchy(targetUser.role, req.user.role)) {
        return res.status(403).json({ message: 'Cannot modify user with higher role' });
      }
    }
    
    return next();
  };
}
```

---

## 6. DATABASE SCHEMA ADJUSTMENTS

### 6.1 New Tables Required

```sql
-- Subscription management
CREATE TABLE IF NOT EXISTS shared.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES shared.tenants(id) ON DELETE CASCADE,
  tier VARCHAR(20) NOT NULL CHECK (tier IN ('free', 'trial', 'paid')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'suspended', 'cancelled', 'expired')),
  billing_period VARCHAR(20), -- 'monthly', 'yearly'
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  trial_end_date TIMESTAMP,
  custom_limits JSONB, -- { storage: number, users: number, apiCalls: number }
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id)
);

CREATE INDEX idx_subscriptions_tenant_id ON shared.subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_status ON shared.subscriptions(status);

-- Subscription history
CREATE TABLE IF NOT EXISTS shared.subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES shared.subscriptions(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES shared.users(id),
  change_type VARCHAR(50) NOT NULL, -- 'tier_change', 'status_change', 'limit_change'
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  changed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscription_history_subscription_id ON shared.subscription_history(subscription_id);
CREATE INDEX idx_subscription_history_changed_at ON shared.subscription_history(changed_at);

-- Manual overrides
CREATE TABLE IF NOT EXISTS shared.manual_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  override_type VARCHAR(50) NOT NULL, -- 'user', 'school', 'platform'
  target_id UUID NOT NULL, -- user_id, tenant_id, or null for platform
  action VARCHAR(100) NOT NULL, -- 'unlock_account', 'bypass_limits', etc.
  reason TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES shared.users(id),
  expires_at TIMESTAMP, -- NULL for permanent overrides
  metadata JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMP,
  revoked_by UUID REFERENCES shared.users(id)
);

CREATE INDEX idx_overrides_type_target ON shared.manual_overrides(override_type, target_id);
CREATE INDEX idx_overrides_active ON shared.manual_overrides(is_active);
CREATE INDEX idx_overrides_expires_at ON shared.manual_overrides(expires_at);

-- Permission overrides (user-level permission customization)
CREATE TABLE IF NOT EXISTS shared.permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES shared.users(id) ON DELETE CASCADE,
  permission VARCHAR(100) NOT NULL,
  granted BOOLEAN NOT NULL, -- true = grant, false = revoke
  granted_by UUID NOT NULL REFERENCES shared.users(id),
  reason TEXT,
  expires_at TIMESTAMP, -- NULL for permanent
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, permission)
);

CREATE INDEX idx_permission_overrides_user_id ON shared.permission_overrides(user_id);
CREATE INDEX idx_permission_overrides_expires_at ON shared.permission_overrides(expires_at);
```

### 6.2 Enhanced Audit Logging

**Existing Table:** `shared.audit_logs` (already exists)

**Enhancements Needed:**
- Ensure `tenant_id` column exists (for school-level filtering)
- Add index on `tenant_id` for performance
- Add index on `action` for filtering
- Add index on `severity` for filtering

```sql
-- Ensure tenant_id column exists
ALTER TABLE shared.audit_logs 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES shared.tenants(id);

-- Add indexes if not exist
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON shared.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON shared.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON shared.audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON shared.audit_logs(created_at);
```

---

## 7. COMPONENT ARCHITECTURE

### 7.1 New Shared Components

```
frontend/src/components/superuser/
├── shared/ (existing)
│   ├── AuditDetailsModal.tsx
│   ├── DateRangeFilter.tsx
│   ├── DeviceInfoCell.tsx
│   ├── MetadataCell.tsx
│   ├── SearchAndFilterBar.tsx
│   └── TagsCell.tsx
├── schools/ (NEW)
│   ├── SchoolDetailsTabs.tsx
│   ├── SubscriptionManagementCard.tsx
│   ├── SubscriptionChangeModal.tsx
│   ├── SubscriptionHistoryTimeline.tsx
│   ├── UsageLimitsEditor.tsx
│   ├── SchoolAuditLogViewer.tsx
│   └── ManualOverridePanel.tsx
├── users/ (NEW)
│   ├── UserDetailsTabs.tsx
│   ├── PermissionMatrixViewer.tsx
│   ├── PermissionPropagationDiagram.tsx
│   ├── PermissionImpactAnalysis.tsx
│   ├── BulkUserActionsModal.tsx
│   └── ManualOverrideModal.tsx
├── roles/ (NEW)
│   ├── RolePermissionsMatrix.tsx
│   ├── PermissionMatrixCell.tsx
│   ├── PermissionEditor.tsx
│   └── ImpactAnalysisModal.tsx
└── overrides/ (NEW)
    ├── OverrideHistoryTable.tsx
    ├── OverrideConfirmationModal.tsx
    └── OverrideStatusBadge.tsx
```

### 7.2 Component Reusability

**DRY Principles Applied:**
- `AuditLogViewer` - Reused for platform and school-level logs
- `DataTable` - Reused across all list views
- `StatusBadge` - Reused for subscription, user, override status
- `Modal` - Reused for all modals
- `DateRangeFilter` - Reused for audit logs, analytics, reports
- `SearchAndFilterBar` - Reused for all filtered lists

---

## 8. SECURITY CONSIDERATIONS

### 8.1 Multi-Tenant Isolation

**Rules:**
1. **SuperUser can access all tenants** - Bypasses normal tenant isolation
2. **School-level audit logs** - Filtered by `tenant_id` in queries
3. **User management** - SuperUser can see all users but operations respect tenant context
4. **Manual overrides** - Scoped to specific tenant or user
5. **All SuperUser actions logged** - Even when bypassing restrictions

### 8.2 Audit Logging Requirements

**All SuperUser actions must log:**
- School creation → `SCHOOL_CREATED`
- Admin creation → `ADMIN_CREATED`
- Subscription change → `SUBSCRIPTION_CHANGED`
- User status change → `USER_STATUS_CHANGED`
- Password reset → `PASSWORD_RESET` (already logged)
- Override creation → `OVERRIDE_CREATED` (severity: 'critical')
- Permission override → `PERMISSION_OVERRIDDEN` (severity: 'critical')
- Role permission change → `ROLE_PERMISSIONS_CHANGED` (severity: 'critical')

### 8.3 Rate Limiting

**SuperUser endpoints:**
- Standard rate limiting applies
- More lenient limits for SuperUser (higher threshold)
- Critical actions (overrides, permission changes) have stricter limits

### 8.4 Input Validation

**All endpoints:**
- Zod schema validation (existing)
- SQL injection prevention (parameterized queries)
- XSS prevention (input sanitization)
- CSRF protection (existing)

---

## 9. IMPLEMENTATION PRIORITY

### 9.1 Phase 7.1: Core Enhancements (High Priority)

1. **Subscription Management**
   - Database schema updates
   - Backend endpoints
   - Frontend UI components
   - Integration with school creation

2. **School-level Audit Logs**
   - Backend filtering
   - Frontend UI
   - Export functionality

3. **Enhanced User Management**
   - User details page
   - Permission visualization
   - Bulk actions

### 9.2 Phase 7.2: Advanced Features (Medium Priority)

4. **Role Permissions Matrix**
   - Backend endpoints
   - Frontend visualization
   - Impact analysis

5. **Manual Override Tools**
   - Database schema
   - Backend endpoints
   - Frontend UI
   - Override history

6. **Permission Propagation**
   - Visualization component
   - Documentation

### 9.3 Phase 7.3: Polish & Optimization (Low Priority)

7. **Custom Reports**
   - Report builder UI
   - Template system
   - Execution engine

8. **Enhanced Analytics**
   - Time-series charts
   - Comparative analytics
   - Export options

---

## 10. TESTING STRATEGY

### 10.1 Backend Tests

**Unit Tests:**
- Permission checks
- Role hierarchy enforcement
- Override creation/revocation
- Subscription status changes
- Audit log filtering

**Integration Tests:**
- School creation flow
- Admin creation flow
- User status updates
- Password reset flow
- Override application

**Security Tests:**
- Cross-tenant access prevention (for non-SuperUser)
- Permission escalation prevention
- Self-modification prevention
- Override expiration

### 10.2 Frontend Tests

**Component Tests:**
- Subscription management components
- Permission matrix components
- Override components
- Audit log viewers

**Integration Tests:**
- School creation flow
- User management flow
- Override creation flow
- Permission visualization

**E2E Tests:**
- Complete school onboarding
- User enable/disable
- Password reset
- Override creation and revocation

---

## 11. DEPLOYMENT PLAN

### 11.1 Database Migrations

**Migration Order:**
1. Create `subscriptions` table
2. Create `subscription_history` table
3. Create `manual_overrides` table
4. Create `permission_overrides` table
5. Add indexes to `audit_logs`
6. Migrate existing data (if any)

### 11.2 Backend Deployment

**Steps:**
1. Deploy new endpoints (behind feature flag)
2. Run database migrations
3. Deploy service updates
4. Enable feature flags
5. Monitor for errors

### 11.3 Frontend Deployment

**Steps:**
1. Deploy new components
2. Deploy new routes
3. Update navigation
4. Test in staging
5. Deploy to production

---

## 12. MONITORING & OBSERVABILITY

### 12.1 Metrics to Track

**SuperUser Actions:**
- School creation rate
- Admin creation rate
- Subscription changes
- User status changes
- Override creation rate
- Permission changes

**Performance:**
- Audit log query performance
- School details page load time
- User details page load time
- Report generation time

**Errors:**
- Failed school creation
- Failed admin creation
- Override failures
- Permission check failures

### 12.2 Alerts

**Critical Alerts:**
- Override creation (immediate notification)
- Permission override (immediate notification)
- Role permission change (immediate notification)
- School deletion (immediate notification)

**Warning Alerts:**
- High override creation rate
- Unusual permission changes
- Failed audit log queries

---

## 13. DOCUMENTATION REQUIREMENTS

### 13.1 User Documentation

**SuperUser Guide:**
- How to create schools
- How to manage subscriptions
- How to manage users
- How to view audit logs
- How to create overrides
- How to manage permissions

### 13.2 Developer Documentation

**API Documentation:**
- OpenAPI spec updates
- Endpoint descriptions
- Request/response examples
- Error codes

**Architecture Documentation:**
- Permission system architecture
- Override system design
- Audit logging architecture
- Multi-tenant isolation

---

## 14. RISK MITIGATION

### 14.1 Security Risks

**Risk:** SuperUser account compromise
**Mitigation:**
- MFA required for SuperUser accounts
- Audit all SuperUser actions
- Alert on suspicious SuperUser activity
- Regular security reviews

**Risk:** Permission escalation
**Mitigation:**
- Role hierarchy enforcement
- Permission change audit logs
- Impact analysis before changes
- Approval workflow for critical changes

**Risk:** Override abuse
**Mitigation:**
- Require reason for all overrides
- Set expiration dates
- Regular override review
- Alert on override creation

### 14.2 Data Risks

**Risk:** Accidental data deletion
**Mitigation:**
- Soft delete for schools
- Audit logs for restoration
- Backup before destructive actions
- Confirmation modals

**Risk:** Cross-tenant data leakage
**Mitigation:**
- Strict tenant filtering
- Query validation
- Audit log monitoring
- Regular security audits

---

## 15. SUCCESS CRITERIA

### 15.1 Functional Requirements

- ✅ SuperUser can create schools with subscription
- ✅ SuperUser can create admin accounts per school
- ✅ SuperUser can modify subscription status
- ✅ SuperUser can enable/disable any user
- ✅ SuperUser can reset password for any user
- ✅ SuperUser can view system-wide audit logs
- ✅ SuperUser can view school-level audit logs
- ✅ SuperUser can monitor login activities
- ✅ SuperUser can generate global usage analytics
- ✅ SuperUser can access platform-wide reporting
- ✅ SuperUser can investigate malpractice
- ✅ SuperUser can use manual override tools
- ✅ Role hierarchy restrictions enforced
- ✅ Permissions propagate correctly top → bottom

### 15.2 Non-Functional Requirements

- ✅ All actions logged in audit logs
- ✅ Multi-tenant isolation maintained
- ✅ Performance: Page load < 2s
- ✅ Security: No permission escalation possible
- ✅ Usability: Intuitive navigation
- ✅ Accessibility: WCAG 2.1 AA compliant

---

## 16. CONCLUSION

This blueprint provides a comprehensive design for expanding SuperUser/Owner capabilities. All 14 required capabilities are addressed with:
- Clear UX flows
- Complete backend endpoint specifications
- Frontend route structure
- Permissions extension plan
- Security considerations
- Implementation priority
- Testing strategy

The design maintains engineering principles:
- ✅ DRY & Modularity
- ✅ File structure discipline
- ✅ Test-before-delete
- ✅ Security & privacy
- ✅ Multi-tenant principles
- ✅ Observability & CI
- ✅ Incremental delivery

**Ready for Phase 8: Implementation**

---

**PHASE 7 COMPLETE — READY FOR PHASE 8**

