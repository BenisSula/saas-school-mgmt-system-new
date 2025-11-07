# SaaS School Management System — Discovery Document (MVP)

**Date:** 2025-11-07  
**Author:** GPT-5 Codex (Discovery Phase Output)

---

## 1. Roles & Permissions Matrix

| Role        | Core Permissions |
|-------------|------------------|
| **Student** | View personal dashboard (attendance, grades, outstanding fees, announcements); submit assignments; pay invoices; receive notifications. |
| **Teacher** | Manage assigned classes; record and amend attendance; create/update exams and grades; view class analytics; communicate with students/guardians. |
| **Admin**   | Provision tenant schema and seed data; configure branding; manage tenant-level users/roles; oversee fees/payments; generate reports; manage notification templates. |
| **SuperAdmin** | Manage platform-wide settings; onboard tenants (create schema, seed data, assign admin); review audit logs; enforce security/privacy policies; manage feature toggles. |

Schema-per-tenant Postgres isolation is mandatory. Every permission must enforce tenant scoping at the database, service, and API layers.

---

## 2. User Stories & Acceptance Criteria

### 2.1 Authentication & RBAC

- **Story:** As a `SuperAdmin`, I want to invite tenant admins so that onboarding is controlled.  
  **Acceptance Criteria:**  
  1. Invitation email contains a signed token scoped to the tenant schema and expires in 72 hours.  
  2. Admin completes setup only when password satisfies policy (≥12 chars, complexity, MFA opt-in).  
  3. Successful activation routes user to the tenant-specific dashboard based on role.

- **Story:** As a `User`, I want MFA-backed login so that accounts remain secure.  
  **Acceptance Criteria:**  
  1. Login requires password + optional OTP (TOTP/SMS) with configurable enforcement by role.  
  2. Failed login attempts are throttled and account locked after configurable threshold.  
  3. Each login attempt and lockout is recorded in audit logs with tenant context.

### 2.2 Multi-Tenant Provisioning (Schema-per-Tenant)

- **Story:** As an `Admin`, I want automated schema creation so that each tenant stays isolated.  
  **Acceptance Criteria:**  
  1. `POST /tenants` kicks off a provisioning job that creates a dedicated Postgres schema, seeds default data, and stores tenant metadata.  
  2. Connection pooling uses tenant_id to target the correct schema, validated by integration tests.  
  3. Queries attempting cross-tenant access are blocked and covered by regression tests.

- **Story:** As a `SuperAdmin`, I want per-tenant resource quotas so that noisy neighbors are limited.  
  **Acceptance Criteria:**  
  1. Usage metrics (CPU, DB connections, storage) tagged by tenant and monitored.  
  2. Threshold breaches trigger alerts via observability stack.  
  3. Rate limiting applies per tenant to critical APIs.

### 2.3 Dashboards

- **Story:** As a `Student`, I want to see my dashboard so that I can track school progress.  
  **Acceptance Criteria:**  
  1. Dashboard surfaces attendance summary, upcoming exams, outstanding fees, and announcements.  
  2. Data loads under 2 seconds at P95 under target concurrency.  
  3. All links navigate to tenant-specific detail pages with RBAC enforced.

- **Story:** As a `Teacher`, I want to manage class tasks so that I stay organized.  
  **Acceptance Criteria:**  
  1. Dashboard shows class schedule, attendance status, grading queue, and announcements.  
  2. Bulk attendance uploads via CSV validated per tenant roster.  
  3. All modifications recorded in audit logs.

- **Story:** As an `Admin`, I want an oversight dashboard so that I can monitor school KPIs.  
  **Acceptance Criteria:**  
  1. Widgets display attendance %, fee collection rates, exam stats, and user activity.  
  2. Data exportable to CSV/PDF with tenant watermarking.  
  3. Widget configuration persists per tenant.

### 2.4 Attendance

- **Story:** As a `Teacher`, I want to record attendance per class session so that records stay accurate.  
  **Acceptance Criteria:**  
  1. Class roster pre-populates from timetable; updates saved transactionally.  
  2. Marking a student absent requires a reason (dropdown + text).  
  3. Attendance analytics refresh within 5 minutes to update dashboards.

- **Story:** As a `Student`, I want to review my attendance history so that I can monitor progress.  
  **Acceptance Criteria:**  
  1. History view filters by date range and course.  
  2. Export to PDF option respects tenant branding.  
  3. Records older than 24 hours are read-only.

### 2.5 Examinations

- **Story:** As a `Teacher`, I want to schedule exams and manage grades so that students stay informed.  
  **Acceptance Criteria:**  
  1. System prevents overlapping exams for the same class or teacher.  
  2. Publishing grades triggers notifications to students/guardians.  
  3. Draft exams remain hidden until published flag is set.

- **Story:** As a `Student`, I want secure access to my grades so that I can track performance.  
  **Acceptance Criteria:**  
  1. Grades visible only after publish flag is true.  
  2. Deep links require authentication and expire after 15 minutes.  
  3. Grade change history logged for auditing.

### 2.6 Fee Management

- **Story:** As an `Admin`, I want to generate invoices so that finances remain transparent.  
  **Acceptance Criteria:**  
  1. Invoice templates support recurring and ad-hoc charges.  
  2. Payment provider integration (e.g., Stripe) handles secure checkout; ledger syncs daily.  
  3. Invoices track status transitions with audit log entries.

- **Story:** As a `Student`, I want to pay invoices online so that payments are convenient.  
  **Acceptance Criteria:**  
  1. Payment initiation returns provider redirect URL with idempotent reference.  
  2. Webhook updates invoice status (paid/failed/refunded) securely with signature validation.  
  3. Receipts emailed upon successful payment using tenant template.

### 2.7 Branding

- **Story:** As an `Admin`, I want to customize branding so that the portal matches school identity.  
  **Acceptance Criteria:**  
  1. Theme editor previews logo, colors, and typography before publishing.  
  2. Accessibility checks enforce contrast ratios and file size limits.  
  3. Tenant-specific assets stored in isolated S3 prefixes and CDN cache invalidated after publish.

- **Story:** As a `SuperAdmin`, I want to enforce brand guardrails so that UX stays consistent.  
  **Acceptance Criteria:**  
  1. System validates branding inputs against global rules (max logo size, allowed file types).  
  2. Overrides require SuperAdmin approval workflow.  
  3. All changes recorded with user, timestamp, and tenant metadata.

---

## 3. Non-Functional Requirements

- **Concurrency & Performance:** 500 concurrent users per tenant; 5,000 platform-wide. API P95 latency < 500 ms; dashboards render < 2 s. Autoscaling and connection pooling tuned for schema isolation.  
- **Availability & Reliability:** SLA 99.9%; scheduled maintenance communicated 48h ahead. Health checks, circuit breakers, retry policies enforced.  
- **Storage & Data Retention:** Avg 20 GB/year per tenant; archival strategy for data older than 7 years; configurable retention (attendance 10 yrs, exams 7 yrs, fees 10 yrs).  
- **Backups & Recovery:** Postgres PITR enabled; RPO ≤ 15 min; RTO ≤ 1 h; nightly snapshots replicated cross-region; restore drills quarterly.  
- **Security Controls:** bcrypt/argon2 hashing; TLS 1.2+; strict CSP; rate limiting; WAF; input validation & sanitization; centralized audit logging; secrets in Vault/Azure Key Vault; encryption at rest (DB + object storage).  
- **Compliance:** GDPR-like policies (data export, erasure workflows); COPPA considerations for minors; processing activity logs; DPIA templates maintained.  
- **Observability & CI:** Feature-branch workflow; tests + lint in CI; automated migrations; structured logging; metrics to Prometheus; tracing via OpenTelemetry.

---

## 4. Integrations & Minimal API Contracts

- **Payment Provider (e.g., Stripe)**  
  - `POST /payments/initiate`: `{ tenant_id, invoice_id, amount, currency, redirect_url }` → returns `{ payment_url, session_id }`.  
  - Webhook `POST /payments/webhook`: includes signature header; payload `{ session_id, status, metadata }`. Idempotent handling required.
- **Email/SMS Provider (e.g., SendGrid/Twilio)**  
  - `POST /notifications/send`: `{ tenant_id, template_id, recipients[], variables{} }`; response `{ message_id }`. Templates versioned per tenant.  
  - Rate limiting per tenant; bounce events fed back into audit logs.
- **Future SSO (Phase 2)**  
  - Support SAML 2.0/OIDC; per-tenant metadata storage; Just-In-Time provisioning toggles.
- **Observability**  
  - Metrics exported to Prometheus with tenant labels; logs shipped via ELK/OpenSearch; alerts configured for SLA breaches.

---

## 5. Prioritized Roadmap

- **MVP (Phase 1):** Auth & RBAC, tenant provisioning (schema-per-tenant), core dashboards (Student/Teacher/Admin), attendance, exam scheduling and grade publish, fee invoicing + payment integration, branding basics, audit logging, notification templates.  
- **Phase 2:** Advanced analytics, guardian accounts, SSO, mobile-responsive enhancements, offline attendance capture, automated billing reconciliation, feature flag controls per tenant.  
- **Phase 3:** LMS integrations, adaptive learning insights, AI-driven alerts, third-party marketplace, regional compliance packs, advanced data warehousing.

---

## 6. Developer Handoff Checklist

- **Environment Variables:** `DB_URL_TEMPLATE`, `TENANT_SCHEMA_PREFIX`, `JWT_SECRET`, `ENCRYPTION_KEY`, `PAYMENT_PUBLIC_KEY`, `PAYMENT_SECRET_KEY`, `EMAIL_API_KEY`, `SMS_API_KEY`, `CDN_BUCKET`, `OBSERVABILITY_ENDPOINTS`, `RATE_LIMIT_CONFIG`.  
- **Secrets Management:** Store secrets in centralized vault; never commit `.env`; rotate keys quarterly.  
- **Tenant Creation Flow:** Call `POST /tenants` → provisioning job creates schema, seeds roles/users, applies default branding → returns admin invite link and temporary credentials.  
- **Test Credentials & Fixtures:** Platform SuperAdmin seed; per-tenant Admin/Teacher/Student demo users; MFA test tokens; sample data for attendance/exams/fees.  
- **CI/CD Requirements:** Lint + unit/integration tests mandatory; automated DB migrations; seed scripts for sample tenant; load/perf test suites in pipeline; automated backups verified.  
- **Operational Playbooks:** Incident response runbooks; backup restore SOP; security/pen-test cadence; monitoring dashboards per tenant.

---

## 7. Human Checkpoints

- All user stories include testable acceptance criteria mapped to modules.  
- Tenancy model explicitly enforces schema-per-tenant isolation across architecture layers.  
- Integrations, SLAs, and resource targets sized for SaaS-scale deployments and realistic MVP roll-out.



