# Superuser Implementation Plan

**Based on Audit Findings**  
**Priority: Critical Security & Compliance Features**

---

## 🎯 Quick Reference: Current vs Required

| Requirement | Status | Implementation Needed |
|------------|--------|----------------------|
| Generate platform-wide reports | ✅ Done | None |
| Create school accounts | ✅ Done | None |
| Create admin accounts | ✅ Done | None |
| Supervise all user activities | ⚠️ Partial | Enhanced audit viewer |
| Trace login history | ❌ Missing | **CRITICAL - Implement now** |
| Disable accounts | ✅ Done | None |
| Change user passwords | ❌ Missing | **CRITICAL - Implement now** |
| Fix platform issues | ⚠️ Partial | Enhanced support tools |
| Investigate malpractices | ⚠️ Partial | Investigation dashboard |

---

## 🔴 PHASE 1: CRITICAL SECURITY FEATURES (Week 1-2)

### 1.1 Login History & Session Tracking

**Database Migration:**
```sql
-- Migration: 010_user_sessions_and_login_history.sql

-- User sessions table
CREATE TABLE IF NOT EXISTS shared.user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES shared.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  device_info JSONB DEFAULT '{}'::jsonb,
  login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  logout_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_user_id ON shared.user_sessions(user_id);
CREATE INDEX idx_user_sessions_tenant_id ON shared.user_sessions(tenant_id);
CREATE INDEX idx_user_sessions_active ON shared.user_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_user_sessions_login_at ON shared.user_sessions(login_at DESC);

-- Login attempts table
CREATE TABLE IF NOT EXISTS shared.login_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  user_id UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES shared.tenants(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_attempts_email ON shared.login_attempts(email);
CREATE INDEX idx_login_attempts_user_id ON shared.login_attempts(user_id);
CREATE INDEX idx_login_attempts_attempted_at ON shared.login_attempts(attempted_at DESC);
CREATE INDEX idx_login_attempts_ip ON shared.login_attempts(ip_address);
```

**Backend Service:**
```typescript
// backend/src/services/sessionService.ts
export async function createSession(
  userId: string,
  tenantId: string | null,
  ipAddress: string,
  userAgent: string
): Promise<string> {
  // Create session record
  // Return session ID
}

export async function getLoginHistory(
  userId: string,
  limit?: number
): Promise<LoginHistoryEntry[]>

export async function getActiveSessions(
  userId: string
): Promise<Session[]>

export async function revokeSession(
  sessionId: string
): Promise<void>

export async function revokeAllUserSessions(
  userId: string
): Promise<void>
```

**API Endpoints:**
```typescript
// backend/src/routes/superuser.ts additions
GET    /superuser/users/:userId/login-history
GET    /superuser/users/:userId/sessions
POST   /superuser/users/:userId/sessions/:sessionId/revoke
POST   /superuser/users/:userId/sessions/revoke-all
GET    /superuser/login-attempts
GET    /superuser/users/:userId/login-attempts
```

**Frontend Components:**
- `LoginHistoryViewer.tsx` - Display user login history
- `SessionManager.tsx` - Manage active sessions
- `LoginAttemptsViewer.tsx` - View failed login attempts

### 1.2 Password Management

**Backend Service:**
```typescript
// backend/src/services/passwordManagementService.ts
export async function adminResetPassword(
  userId: string,
  newPassword: string,
  actorId: string
): Promise<void>

export async function adminChangePassword(
  userId: string,
  newPassword: string,
  actorId: string
): Promise<void>

export async function getPasswordHistory(
  userId: string
): Promise<PasswordChangeEntry[]>
```

**API Endpoints:**
```typescript
POST   /superuser/users/:userId/reset-password
POST   /superuser/users/:userId/change-password
GET    /superuser/users/:userId/password-history
POST   /superuser/users/bulk-reset-password
```

**Frontend Components:**
- `PasswordManagementModal.tsx` - Reset/change password UI
- `PasswordHistoryViewer.tsx` - View password change history

### 1.3 Platform-Wide Audit Logs

**Backend Service:**
```typescript
// backend/src/services/platformAuditService.ts
export async function getPlatformAuditLogs(
  filters: {
    tenantId?: string;
    userId?: string;
    entityType?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }
): Promise<AuditLogEntry[]>
```

**API Endpoints:**
```typescript
GET    /superuser/audit-logs
GET    /superuser/audit-logs/export
```

**Frontend Components:**
- `PlatformAuditLogViewer.tsx` - Cross-tenant audit log viewer

---

## 🟡 PHASE 2: ENHANCED MONITORING (Week 3-4)

### 2.1 Activity Monitoring Dashboard
- Real-time activity feed
- User activity timeline
- Activity pattern visualization

### 2.2 Enhanced User Management
- Add password management buttons
- Add login history link
- Add session management

---

## 🟢 PHASE 3: INVESTIGATION TOOLS (Month 2)

### 3.1 Investigation Dashboard
- User behavior analysis
- Anomaly detection
- Case management

---

## 📋 Implementation Checklist

### Database
- [ ] Create `shared.user_sessions` table
- [ ] Create `shared.login_attempts` table
- [ ] Create `shared.password_change_history` table
- [ ] Add indexes for performance

### Backend Services
- [ ] `sessionService.ts` - Session management
- [ ] `passwordManagementService.ts` - Password operations
- [ ] `platformAuditService.ts` - Cross-tenant audit logs
- [ ] Update `authService.ts` to track sessions
- [ ] Update `authService.ts` to track login attempts

### API Routes
- [ ] Add session management endpoints
- [ ] Add password management endpoints
- [ ] Add platform audit log endpoints
- [ ] Add login history endpoints

### Frontend Pages
- [ ] `SuperuserLoginHistoryPage.tsx`
- [ ] `SuperuserSessionManagementPage.tsx`
- [ ] `SuperuserPasswordManagementPage.tsx`
- [ ] `SuperuserPlatformAuditPage.tsx`

### Frontend Components
- [ ] `LoginHistoryViewer.tsx`
- [ ] `SessionManager.tsx`
- [ ] `PasswordManagementModal.tsx`
- [ ] `PlatformAuditLogViewer.tsx`

---

## 🔐 Security Considerations

1. **Password Reset Security:**
   - Require superuser authentication
   - Log all password changes
   - Notify user of password changes
   - Force logout after password change

2. **Session Management:**
   - Track IP addresses
   - Detect suspicious sessions
   - Auto-revoke expired sessions
   - Alert on multiple active sessions

3. **Audit Trail:**
   - Log all superuser actions
   - Include actor information
   - Store before/after values
   - Exportable for compliance

---

## 📊 Success Metrics

- ✅ All user logins tracked
- ✅ All sessions manageable
- ✅ Password reset capability
- ✅ Platform-wide audit visibility
- ✅ Activity monitoring operational
- ✅ Investigation tools available

---

## 🚀 Next Steps

1. Review and approve implementation plan
2. Create database migrations
3. Implement backend services
4. Build API endpoints
5. Create frontend components
6. Test security features
7. Deploy to production

