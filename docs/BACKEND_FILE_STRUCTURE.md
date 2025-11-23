# Backend File Structure

Complete file structure documentation for the SaaS School Management System backend application.

## Overview

The backend is built with **Express.js + TypeScript** and follows a modular, service-oriented architecture with schema-per-tenant PostgreSQL isolation. The structure emphasizes separation of concerns, security, and maintainability.

---

## Root Directory Structure

```
backend/
├── src/                          # Source code directory
├── tests/                        # Integration and unit tests
├── dist/                         # Compiled JavaScript output
├── node_modules/                 # Dependencies
├── exports/                      # Exported files (credentials, reports)
├── reports/                      # Generated reports
├── scripts/                      # Utility scripts (PowerShell, etc.)
├── package.json                  # Backend dependencies and scripts
├── package-lock.json            # Dependency lock file
├── tsconfig.json                 # TypeScript configuration
├── tsconfig.build.json           # Build-specific TypeScript config
├── jest.config.ts                # Jest test configuration
├── jest.setup.ts                 # Jest test setup
├── jest-resolver.js             # Jest module resolver
├── Dockerfile                    # Docker container definition
├── openapi.yaml                  # OpenAPI/Swagger specification
└── [various Node.js built-in modules] # Node.js polyfills for Jest
```

---

## Source Code Structure (`src/`)

### Entry Points

```
src/
├── server.ts                     # Application entry point, HTTP server setup, WebSocket initialization
├── app.ts                        # Express app configuration, middleware setup, route registration
└── __tests__/                    # Source-level tests (currently empty)
```

**Key Files:**
- **`server.ts`**: Initializes database connection, runs migrations, starts HTTP/WebSocket servers, handles graceful shutdown
- **`app.ts`**: Configures Express middleware (CORS, body parsing, authentication, rate limiting), registers all route handlers

---

### Configuration (`config/`)

```
src/config/
└── permissions.ts                # RBAC permission definitions and role mappings
```

**Purpose**: Centralized permission configuration for role-based access control.

---

### Database Layer (`db/`)

```
src/db/
├── connection.ts                 # PostgreSQL connection pool management
├── migrate.ts                   # Migration runner (executes SQL migration files)
├── runMigrations.ts             # Migration execution with error handling
├── runMigrationsWithTracking.ts # Migration execution with status tracking
├── schemaIntrospection.ts       # Database schema introspection utilities
├── tenantManager.ts             # Tenant schema creation, deletion, isolation management
└── migrations/                  # SQL migration files
    ├── 001_shared_schema.sql
    ├── 002_add_tenant_platform_fields.sql
    ├── 003_superuser_support.sql
    ├── 004_department_hierarchy.sql
    ├── 004_platform_billing.sql
    ├── 005_security_features.sql
    ├── 005_teacher_phase3.sql
    ├── 006_resource_quotas.sql
    ├── 006_student_phase4.sql
    ├── 007_enhanced_audit.sql
    ├── 007_users_updated_at.sql
    ├── 008_onboarding_automation.sql
    ├── 008_users_status.sql
    ├── 009_add_hod_role.sql
    ├── 009_feature_flags.sql
    ├── 010_backfill_user_status.sql
    ├── 010_email_templates.sql
    ├── 011_add_pending_profile_data.sql
    ├── 011_seed_email_templates.sql
    ├── 012_advanced_reporting.sql
    ├── 013_support_communication.sql
    ├── 014_data_management_sso.sql
    ├── 015_user_sessions_and_login_history.sql
    ├── 016_password_change_history.sql
    ├── 017_investigation_cases.sql
    ├── 018_additional_roles.sql
    ├── 019_superuser_capabilities.sql
    ├── 020_add_metadata_to_additional_roles.sql
    ├── 021_subscription_tiers_config.sql
    ├── 022_file_uploads_table.sql
    ├── 025_migrate_hod_role_to_additional_roles.sql
    ├── 029_stripe_integration_fields.sql
    └── tenants/                 # Tenant-specific migrations
        ├── 001_core_tables.sql
        ├── 002_admin_academics.sql
        ├── 003_student_portal.sql
        ├── 004_audit_logs.sql
        ├── 005_teacher_phase3.sql
        ├── 006_student_phase4.sql
        ├── 007_notifications.sql
        ├── 023_add_enrollment_status_to_students.sql
        ├── 024_class_change_requests.sql
        ├── 026_add_attendance_indexes.sql
        ├── 027_add_class_resources_table.sql
        └── 028_add_class_announcements_table.sql
```

**Purpose**: Database schema management, migrations, and tenant isolation.

---

### Middleware (`middleware/`)

```
src/middleware/
├── authenticate.ts              # JWT authentication middleware
├── authorizeSuperUser.ts        # SuperUser authorization check
├── auditAdminActions.ts          # Audit logging for admin operations
├── cache.ts                      # HTTP caching policies
├── csrf.ts                       # CSRF token generation and validation
├── enhancedTenantIsolation.ts    # Enhanced tenant data isolation
├── ensureTenantContext.ts        # Ensures tenant context is set
├── errorHandler.ts               # Global error handling middleware
├── featureFlag.ts                # Feature flag checking middleware
├── ipWhitelist.ts                # IP whitelist enforcement
├── metrics.ts                    # Prometheus metrics collection
├── mutationRateLimiter.ts        # Rate limiting for mutation operations
├── pagination.ts                 # Request pagination parsing
├── quotaEnforcement.ts           # Resource quota enforcement
├── rateLimiter.ts                # General rate limiting
├── rateLimitPerTenant.ts         # Tenant-specific rate limiting
├── rbac.ts                       # Role-based access control middleware
├── tenantResolver.ts             # Tenant resolution from request
├── validateInput.ts              # Input sanitization and validation
├── validateRequest.ts            # Request validation middleware
├── validation.ts                 # General validation utilities
├── verifyTeacherAssignment.ts    # Teacher assignment verification
└── verifyTeacherOrAdminAccess.ts # Teacher/Admin access verification
```

**Purpose**: Request processing, authentication, authorization, security, and data validation.

---

### Routes (`routes/`)

```
src/routes/
├── admin/                        # Admin-specific routes
│   ├── billing.ts                # Admin billing management
│   ├── classes.ts                # Class management
│   ├── dashboard.ts              # Admin dashboard data
│   ├── departments.ts            # Department management
│   ├── notifications.ts          # Admin notifications
│   ├── overview.ts               # Admin overview/statistics
│   ├── passwords.ts              # Password management
│   ├── reports.ts                # Report generation
│   ├── userManagement.ts         # User management operations
│   └── users.ts                  # User CRUD operations
├── auth/                         # Authentication routes
│   └── sso.ts                    # Single Sign-On (SSO) routes
├── notifications/                # Notification routes
│   └── email.ts                  # Email notification endpoints
├── superuser/                    # SuperUser routes
│   ├── audit.ts                  # Platform audit logs
│   ├── billing.ts                # Platform billing management
│   ├── dataManagement.ts        # Data management operations
│   ├── featureFlags.ts           # Feature flag management
│   ├── investigations.ts         # Security investigations
│   ├── maintenance.ts           # Platform maintenance
│   ├── onboarding.ts             # Tenant onboarding
│   ├── overrides.ts              # Permission overrides
│   ├── passwords.ts              # Password management
│   ├── permissionOverrides.ts    # Permission override management
│   ├── reports.ts                # Platform reports
│   ├── roles.ts                  # Role management
│   ├── schools.ts                # School/tenant management
│   ├── sessions.ts               # Session management
│   └── users.ts                  # User management
├── support/                      # Support system routes
│   ├── announcements.ts          # System announcements
│   ├── index.ts                  # Support router index
│   ├── knowledgeBase.ts         # Knowledge base articles
│   ├── messages.ts               # Support messages
│   ├── status.ts                 # System status page
│   └── tickets.ts                # Support tickets
├── webhooks/                     # Webhook handlers
│   └── stripe.ts                 # Stripe webhook handler
├── adminAcademics.ts             # Admin academic operations
├── attendance.ts                 # Attendance management
├── audit.ts                      # Audit log routes
├── auth.ts                       # Authentication routes (login, register, etc.)
├── branding.ts                   # Branding/theme management
├── configuration.ts              # System configuration
├── exams.ts                      # Exam management
├── export.ts                     # Data export routes
├── grades.ts                     # Grade management
├── health.ts                     # Health check endpoint
├── hod.ts                        # Head of Department routes
├── incident-response.ts          # Incident response routes
├── invoices.ts                   # Invoice management
├── metrics.ts                    # Metrics endpoint
├── notifications.ts              # Notification routes
├── payments.ts                   # Payment processing
├── reports.ts                    # Report generation
├── results.ts                    # Student results
├── school.ts                     # School information
├── schools.ts                    # Public schools listing
├── search.ts                     # Search functionality
├── studentPortal.ts              # Student portal routes
├── students.ts                   # Student management
├── superuser.ts                  # SuperUser router index
├── teacher.ts                    # Teacher-specific routes
├── teachers.ts                   # Teacher management
├── tenants.ts                    # Tenant management
├── upload.ts                     # File upload handling
└── users.ts                      # User management routes
```

**Purpose**: HTTP route handlers that process requests and delegate to services.

---

### Services (`services/`)

```
src/services/
├── admin/                        # Admin-specific services
│   ├── classService.ts           # Class management service
│   └── departmentService.ts      # Department management service
├── audit/                        # Audit services
│   └── enhancedAuditService.ts  # Enhanced audit logging
├── billing/                      # Billing services
│   ├── __tests__/                # Billing service tests
│   │   └── stripeService.test.ts
│   ├── invoiceService.ts         # Invoice management
│   ├── paymentService.ts         # Payment processing
│   ├── stripeService.ts          # Stripe integration
│   └── subscriptionService.ts    # Subscription management
├── dataManagement/               # Data management services
│   ├── backupService.ts          # Backup operations
│   ├── exportImportService.ts    # Data export/import
│   └── gdprService.ts           # GDPR compliance operations
├── email/                        # Email services
│   └── emailService.ts           # Email sending service
├── featureFlags/                 # Feature flag services
│   └── featureFlagService.ts     # Feature flag management
├── monitoring/                   # Monitoring services
│   ├── errorTracking.ts          # Error tracking and logging
│   ├── healthService.ts          # Health check service
│   ├── incidentResponse.ts       # Incident response handling
│   ├── loggingService.ts         # Centralized logging
│   └── platformMetricsService.ts # Platform metrics collection
├── onboarding/                   # Onboarding services
│   └── onboardingService.ts     # Tenant onboarding automation
├── payments/                     # Payment services
│   └── provider.ts               # Payment provider abstraction
├── quotas/                       # Quota services
│   └── quotaService.ts          # Resource quota management
├── reports/                      # Reporting services
│   ├── customReportBuilderService.ts  # Custom report builder
│   ├── reportExportService.ts    # Report export functionality
│   ├── reportGenerationService.ts     # Report generation
│   └── reportSchedulingService.ts     # Scheduled reports
├── security/                     # Security services
│   ├── ipWhitelistService.ts     # IP whitelist management
│   ├── mfaService.ts             # Multi-factor authentication
│   ├── passwordPolicyService.ts  # Password policy enforcement
│   └── sessionService.ts         # Session management
├── shared/                       # Shared service utilities
│   ├── adminHelpers.ts           # Admin helper functions
│   └── tenantQueries.ts          # Tenant query utilities
├── sso/                          # SSO services
│   ├── oauthService.ts           # OAuth implementation
│   └── samlService.ts            # SAML implementation
├── superuser/                    # SuperUser services
│   ├── investigationService.ts  # Security investigations
│   ├── maintenanceService.ts    # Platform maintenance
│   ├── overrideService.ts        # Permission overrides
│   ├── passwordManagementService.ts  # Password management
│   ├── permissionOverrideService.ts  # Permission override management
│   ├── platformAuditService.ts  # Platform audit service
│   ├── sessionCleanupService.ts  # Session cleanup jobs
│   ├── sessionService.ts         # Session management
│   ├── subscriptionService.ts   # Subscription management
│   └── subscriptionTierService.ts    # Subscription tier management
├── support/                      # Support services
│   ├── announcementsService.ts   # System announcements
│   ├── knowledgeBaseService.ts  # Knowledge base management
│   ├── messagingService.ts      # Support messaging
│   ├── statusPageService.ts      # Status page management
│   └── ticketingService.ts       # Support ticket management
├── adminOverviewService.ts       # Admin overview/statistics
├── adminUserService.ts           # Admin user management
├── attendanceService.ts           # Attendance management
├── auditLogService.ts             # Audit log service
├── authService.ts                # Authentication service
├── authValidation.ts             # Authentication validation
├── brandingService.ts            # Branding/theme service
├── classChangeRequestService.ts  # Class change requests
├── classResourcesService.ts      # Class resources management
├── examService.ts                # Exam management
├── exportService.ts              # Data export service
├── fileUploadService.ts          # File upload handling
├── hodService.ts                 # Head of Department service
├── invoiceService.ts             # Invoice service (legacy)
├── notificationService.ts        # Notification service
├── onboardingService.ts          # Onboarding service (legacy)
├── passwordResetService.ts       # Password reset service
├── paymentService.ts             # Payment service (legacy)
├── platformMonitoringService.ts  # Platform monitoring (legacy)
├── profileService.ts             # User profile management
├── quotaService.ts               # Quota service (legacy)
├── reportService.ts              # Report service (legacy)
├── schoolService.ts              # School management
├── searchService.ts              # Search functionality
├── studentDashboardService.ts    # Student dashboard data
├── studentPortalService.ts       # Student portal service
├── studentService.ts             # Student management
├── subjectService.ts             # Subject management
├── superuserService.ts           # SuperUser service (legacy)
├── teacherAnnouncementsService.ts # Teacher announcements
├── teacherAttendanceService.ts   # Teacher attendance management
├── teacherDashboardService.ts    # Teacher dashboard data
├── teacherGradesService.ts       # Teacher grade management
├── teacherService.ts             # Teacher management
├── tenantLookupService.ts        # Tenant lookup service
├── termService.ts                # Academic term management
├── tokenService.ts               # JWT token management
├── userPasswordService.ts        # User password management
├── userRegistrationService.ts    # User registration service
└── userService.ts                # User management service
```

**Purpose**: Business logic layer that handles data processing, database operations, and external integrations.

---

### Libraries & Utilities (`lib/`)

```
src/lib/
├── serializers/                  # Data serializers
│   ├── deviceInfoSerializer.ts   # Device information serialization
│   └── userSerializer.ts         # User data serialization
├── apiErrors.ts                  # API error definitions
├── auditHelpers.ts               # Audit logging helpers
├── authErrors.ts                 # Authentication error definitions
├── contextHelpers.ts             # Request context utilities
├── crudHelpers.ts                # CRUD operation helpers
├── dbHelpers.ts                  # Database helper functions
├── envValidation.ts              # Environment variable validation
├── friendlyMessages.ts           # User-friendly error messages
├── logger.ts                     # Logging utility
├── passwordRouteHelpers.ts      # Password-related route helpers
├── profileTransformUtils.ts      # Profile data transformation
├── queryUtils.ts                 # Database query utilities
├── responseHelpers.ts            # HTTP response helpers
├── roleUtils.ts                  # Role utility functions
├── routeHelpers.ts               # Route helper functions
├── serviceUtils.ts               # Service utility functions
├── superuserHelpers.ts           # SuperUser helper functions
├── validationHelpers.ts         # Validation helper functions
└── websocket.ts                  # WebSocket manager
```

**Purpose**: Reusable utility functions, helpers, and shared logic.

---

### Validators (`validators/`)

```
src/validators/
├── brandingValidator.ts          # Branding data validation
├── examValidator.ts              # Exam data validation
├── invoiceValidator.ts           # Invoice data validation
├── schoolValidator.ts            # School data validation
├── studentValidator.ts           # Student data validation
├── subjectValidator.ts           # Subject data validation
├── superuserAuditValidator.ts    # SuperUser audit validation
├── superuserInvestigationValidator.ts  # Investigation validation
├── superuserLoginAttemptsValidator.ts  # Login attempts validation
├── superuserPasswordValidator.ts # Password validation
├── superuserSessionValidator.ts  # Session validation
├── superuserValidator.ts         # SuperUser data validation
├── teacherValidator.ts           # Teacher data validation
├── termValidator.ts              # Term data validation
└── userValidator.ts              # User data validation
```

**Purpose**: Input validation schemas and validation logic using Zod.

---

### Scripts (`scripts/`)

```
src/scripts/
├── checkMigrationStatus.ts       # Check migration status
├── checkNewHorizonStudents.ts    # Check New Horizon students
├── checkUserRole.ts              # Check user role
├── cleanupEmptyAssignments.ts    # Cleanup empty assignments
├── createSchoolRecord.ts         # Create school record
├── exportCredentials.ts          # Export user credentials
├── exportUserCredentials.ts      # Export user credentials (alternative)
├── fixHodRoles.ts                # Fix HOD roles
├── fixMigrationIndexes.ts        # Fix migration indexes
├── fixMigrationTriggers.ts       # Fix migration triggers
├── fixTeacherAssignments.ts      # Fix teacher assignments
├── getStudentCredentials.ts      # Get student credentials
├── README.md                     # Scripts documentation
├── reset-postgres-password.ts    # Reset PostgreSQL password
├── runPhase7Migrations.ts        # Run Phase 7 migrations
├── runSingleMigration.ts         # Run single migration
├── seedDemo.ts                   # Seed demo tenant data
├── seedSuperUserSetup.ts         # Seed superuser setup
├── setup-db-complete.ts          # Complete database setup
├── simulatePhase5Interactions.ts # Simulate Phase 5 interactions
├── simulatePhase6Validation.ts   # Simulate Phase 6 validation
├── testSubscriptionCreation.ts   # Test subscription creation
├── testWebhook.ts                # Test webhook functionality
├── validateEnv.ts                # Validate environment variables
├── verifyAllSchools.ts           # Verify all schools
├── verifyAndFixUsers.ts          # Verify and fix users
├── verifyClassAccess.ts          # Verify class access
├── verifyStripeConfig.ts         # Verify Stripe configuration
└── verifyTeacherRosters.ts       # Verify teacher rosters
```

**Purpose**: Utility scripts for database setup, data seeding, testing, and maintenance.

---

### Seed Data (`seed/`)

```
src/seed/
└── demoTenant.ts                 # Demo tenant data seeding
```

**Purpose**: Data seeding for development and testing.

---

### Utilities (`utils/`)

```
src/utils/
├── errorUtils.ts                 # Error handling utilities
└── loginDiagnostics.ts           # Login diagnostic utilities
```

**Purpose**: General utility functions.

---

## Test Structure (`tests/`)

```
tests/
├── lib/                          # Test utilities
│   └── roleUtils.test.ts         # Role utility tests
├── services/                     # Service tests
│   ├── shared/                   # Shared service tests
│   └── hodService.test.ts        # HOD service tests
├── utils/                        # Test utilities
│   ├── testDb.js                 # Test database setup (JS)
│   └── testDb.ts                 # Test database setup (TS)
├── mocks/                        # Test mocks
│   └── formidable.js             # Formidable mock
├── admin-hod-teacher-flow.test.ts      # Admin/HOD/Teacher flow tests
├── adminAcademicsRoutes.test.js        # Admin academics routes tests (JS)
├── adminAcademicsRoutes.test.ts        # Admin academics routes tests (TS)
├── apiIntegration.test.ts              # API integration tests
├── attendanceRoutes.test.js            # Attendance routes tests (JS)
├── attendanceRoutes.test.ts            # Attendance routes tests (TS)
├── auth.test.js                        # Authentication tests (JS)
├── auth.test.ts                        # Authentication tests (TS)
├── authErrorCodes.test.ts               # Auth error code tests
├── authService.transaction.test.ts     # Auth service transaction tests
├── authValidation.test.ts              # Auth validation tests
├── configRoutes.test.js                 # Config routes tests (JS)
├── configRoutes.test.ts                 # Config routes tests (TS)
├── emailValidation.test.ts             # Email validation tests
├── examRoutes.test.js                   # Exam routes tests (JS)
├── examRoutes.test.ts                   # Exam routes tests (TS)
├── feeRoutes.test.js                    # Fee routes tests (JS)
├── feeRoutes.test.ts                    # Fee routes tests (TS)
├── health.test.js                       # Health check tests (JS)
├── health.test.ts                       # Health check tests (TS)
├── passwordValidation.test.ts          # Password validation tests
├── phase3-teacher-authorization.test.ts # Phase 3 teacher auth tests
├── platformMonitoringService.test.ts    # Platform monitoring tests
├── queryUtils.test.ts                   # Query utility tests
├── rbac.test.ts                         # RBAC tests
├── reportRoutes.test.js                 # Report routes tests (JS)
├── reportRoutes.test.ts                 # Report routes tests (TS)
├── resultsRoutes.test.ts                # Results routes tests
├── roleBasedRoutes.test.ts              # Role-based routes tests
├── roleValidation.test.ts               # Role validation tests
├── studentRoutes.test.js                # Student routes tests (JS)
├── studentRoutes.test.ts                # Student routes tests (TS)
├── superuser-admin-flow.test.ts         # SuperUser/Admin flow tests
├── teacher-student-attendance.test.ts   # Teacher/Student attendance tests
├── teacherAssignmentService.test.ts     # Teacher assignment tests
├── teacherBrandingRoutes.test.js        # Teacher branding tests (JS)
├── teacherBrandingRoutes.test.ts        # Teacher branding tests (TS)
├── teacherDashboardRoutes.test.js      # Teacher dashboard tests (JS)
├── teacherDashboardRoutes.test.ts      # Teacher dashboard tests (TS)
├── teacherRoutes.test.ts                # Teacher routes tests
├── tenantIsolation.test.ts              # Tenant isolation tests
├── tenantManager.test.js                # Tenant manager tests (JS)
├── tenantManager.test.ts                # Tenant manager tests (TS)
├── userRoutes.test.js                   # User routes tests (JS)
├── userRoutes.test.ts                   # User routes tests (TS)
├── verifyTeacherAssignment.test.ts      # Teacher assignment verification tests
└── PHASE3_TEST_SUMMARY.md               # Phase 3 test summary
```

**Purpose**: Comprehensive test coverage for routes, services, middleware, and utilities.

---

## Configuration Files

```
backend/
├── package.json                  # Dependencies, scripts, project metadata
├── package-lock.json            # Dependency lock file
├── tsconfig.json                 # TypeScript compiler configuration
├── tsconfig.build.json           # Build-specific TypeScript config
├── jest.config.ts                # Jest test runner configuration
├── jest.setup.ts                 # Jest test environment setup
├── jest-resolver.js             # Jest module resolver for Node.js built-ins
├── Dockerfile                    # Docker container definition
└── openapi.yaml                  # OpenAPI/Swagger API specification
```

---

## Key Architectural Patterns

### 1. **Layered Architecture**
- **Routes**: HTTP request handling
- **Services**: Business logic
- **Database**: Data persistence
- **Middleware**: Cross-cutting concerns

### 2. **Multi-Tenant Isolation**
- Schema-per-tenant PostgreSQL isolation
- Tenant context resolution via middleware
- Enhanced tenant isolation checks

### 3. **Security First**
- JWT authentication with refresh tokens
- RBAC middleware for authorization
- CSRF protection
- Rate limiting per tenant
- Input sanitization and validation

### 4. **Service-Oriented**
- Modular service layer
- Shared utilities and helpers
- Separation of concerns

### 5. **Testing**
- Jest for unit and integration tests
- Test utilities and mocks
- Comprehensive route and service coverage

---

## File Count Summary

- **Routes**: ~50+ route files
- **Services**: ~86 service files
- **Middleware**: ~23 middleware files
- **Migrations**: 44 SQL migration files
- **Validators**: 15 validator files
- **Tests**: 50+ test files
- **Scripts**: 30+ utility scripts

---

## Development Workflow

1. **Entry Point**: `server.ts` → `app.ts`
2. **Request Flow**: Route → Middleware → Service → Database
3. **Response Flow**: Database → Service → Route → Response
4. **Error Handling**: Global error handler in `middleware/errorHandler.ts`
5. **Authentication**: JWT validation in `middleware/authenticate.ts`
6. **Authorization**: RBAC checks in `middleware/rbac.ts`

---

## Notes

- All TypeScript files compile to `dist/` directory
- Migrations are versioned and tracked
- Services follow single responsibility principle
- Middleware is composable and reusable
- Tests use `pg-mem` for in-memory database testing
- WebSocket support via `lib/websocket.ts`
- Prometheus metrics collection via `middleware/metrics.ts`

---

*Last Updated: Based on current codebase structure*


