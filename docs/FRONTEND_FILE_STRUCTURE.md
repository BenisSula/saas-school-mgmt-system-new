# Frontend File Structure

Complete file structure documentation for the SaaS School Management System frontend application.

## Overview

The frontend is built with **React + TypeScript + Vite** and follows a component-based, atomic design architecture with role-aware routing, theming, and comprehensive state management. The structure emphasizes reusability, accessibility, and maintainability.

---

## Root Directory Structure

```
frontend/
├── src/                          # Source code directory
├── public/                       # Static assets
│   └── vite.svg                  # Vite logo
├── dist/                         # Production build output
├── e2e/                          # End-to-end tests (Playwright)
├── node_modules/                 # Dependencies
├── test-results/                 # Test execution results
├── playwright-report/            # Playwright test reports
├── package.json                  # Frontend dependencies and scripts
├── package-lock.json            # Dependency lock file
├── pnpm-lock.yaml               # pnpm lock file
├── tsconfig.json                 # TypeScript configuration
├── tsconfig.tests.json           # Test-specific TypeScript config
├── vite.config.ts                # Vite build configuration
├── vitest.setup.ts               # Vitest test setup
├── playwright.config.ts          # Playwright E2E test configuration
├── postcss.config.cjs            # PostCSS configuration
├── tailwind.config.cjs           # Tailwind CSS configuration
├── index.html                    # HTML entry point
├── Dockerfile                    # Docker container definition
└── [documentation files]         # Various markdown documentation files
```

---

## Source Code Structure (`src/`)

### Entry Points

```
src/
├── main.tsx                      # Application entry point, React root setup
├── App.tsx                        # Main app component, routing configuration
└── index.tsx                     # Legacy entry point (redirects to main.tsx)
```

**Key Files:**
- **`main.tsx`**: Initializes React root, sets up providers (QueryClient, BrandProvider, AuthProvider), configures routing
- **`App.tsx`**: Defines all routes, lazy loading, protected routes, layout shells, and navigation logic

---

### Pages (`pages/`)

```
src/pages/
├── admin/                        # Admin role pages
│   ├── AdminAttendancePage.tsx
│   ├── AdminBillingPage.tsx
│   ├── AdminClassAssignmentPage.tsx
│   ├── AdminClassesSubjectsPage.tsx
│   ├── AdminDepartmentAnalyticsPage.tsx
│   ├── AdminExamConfigPage.tsx
│   ├── AdminOverviewPage.tsx
│   ├── AdminReportsPage.tsx
│   ├── announcements/
│   │   └── page.tsx
│   ├── classes/
│   │   └── page.tsx
│   ├── ConfigurationPage.tsx
│   ├── dashboard/
│   │   └── page.tsx
│   ├── departments/
│   │   └── page.tsx
│   ├── HODsManagementPage.tsx
│   ├── InvoicePage.tsx
│   ├── reports/
│   │   └── page.tsx
│   ├── ReportsPage.tsx
│   ├── RoleManagementPage.tsx
│   ├── StudentsManagementPage.tsx
│   ├── TeachersManagementPage.tsx
│   └── users/
│       └── page.tsx
├── auth/                         # Authentication pages
│   ├── Auth.tsx                  # Unified auth page (login/register)
│   ├── Login.tsx                 # Login page (legacy)
│   └── Register.tsx              # Register page (legacy)
├── hod/                          # Head of Department pages
│   ├── DepartmentReportsPage.tsx
│   ├── HODDashboardPage.tsx
│   ├── HODProfilePage.tsx
│   └── TeachersUnderHodPage.tsx
├── student/                      # Student role pages
│   ├── StudentAnnouncementsPage.tsx
│   ├── StudentAttendancePage.tsx
│   ├── StudentDashboardPage.tsx
│   ├── StudentFeesPage.tsx
│   ├── StudentMessagesPage.tsx
│   ├── StudentProfilePage.tsx
│   ├── StudentReportsPage.tsx
│   ├── StudentResourcesPage.tsx
│   └── StudentResultsPage.tsx
├── superuser/                    # SuperUser role pages
│   ├── activity/
│   │   └── index.tsx
│   ├── dashboard/
│   │   └── index.tsx
│   ├── investigations/
│   │   ├── [caseId]/
│   │   │   └── index.tsx
│   │   ├── create/
│   │   │   └── index.tsx
│   │   └── index.tsx
│   ├── maintenance/
│   │   └── page.tsx
│   ├── users/
│   │   └── [userId]/
│   │       └── activity/
│   │           └── index.tsx
│   ├── SuperuserManageSchoolsPage.tsx
│   ├── SuperuserOverviewPage.tsx
│   ├── SuperuserOverviewPage.test.tsx
│   ├── SuperuserReportsPage.tsx
│   ├── SuperuserSettingsPage.tsx
│   ├── SuperuserSubscriptionsPage.tsx
│   ├── SuperuserSupportPage.tsx
│   ├── SuperuserTenantAnalyticsPage.tsx
│   ├── SuperuserUsageMonitoringPage.tsx
│   └── SuperuserUsersPage.tsx
├── teacher/                      # Teacher role pages
│   ├── AttendancePage.tsx
│   ├── GradeEntryPage.tsx
│   ├── TeacherAnnouncementsPage.tsx
│   ├── TeacherClassesPage.tsx
│   ├── TeacherClassResourcesPage.tsx
│   ├── TeacherDashboardPage.tsx
│   ├── TeacherMessagesPage.tsx
│   ├── TeacherProfilePage.tsx
│   ├── TeacherReportsPage.tsx
│   └── TeacherStudentsPage.tsx
├── index.tsx                     # Home page
├── LandingPage.tsx               # Public landing page
├── NotAuthorizedPage.tsx         # 403 unauthorized page
├── PlaceholderPage.tsx           # Placeholder for incomplete features
└── TestLoginPage.tsx             # Test login page (development)
```

**Purpose**: Page-level components organized by user role and feature area.

---

### Components (`components/`)

#### UI Components (`components/ui/`)

```
src/components/ui/
├── __tests__/                    # UI component tests
│   ├── brandProvider.test.tsx
│   ├── button.test.tsx
│   └── modal.test.tsx
├── examples/                     # Component examples
│   └── ExamplesGallery.tsx
├── AvatarDropdown.tsx            # User avatar with dropdown menu
├── Badge.tsx                     # Badge component
├── BrandProvider.tsx             # Branding/theme provider
├── Button.tsx                    # Button component
├── Card.tsx                      # Card container
├── Collapsible.tsx               # Collapsible content
├── DashboardSkeleton.tsx         # Loading skeleton for dashboards
├── DatePicker.tsx                # Date picker component
├── Input.tsx                     # Input field component
├── Modal.tsx                     # Modal dialog
├── ModalWithCloseControl.tsx     # Modal with close control
├── Navbar.tsx                    # Navigation bar
├── Notifications.tsx             # Notification component
├── SearchBar.tsx                 # Search input component
├── Select.tsx                    # Select dropdown
├── Sidebar.tsx                   # Sidebar navigation
├── StatusBadge.tsx               # Status indicator badge
├── StatusBanner.tsx              # Status banner
├── Table.tsx                     # Table component
├── Textarea.tsx                  # Textarea component
├── ThemeToggle.tsx               # Theme toggle button
├── ThemeToggleWithTooltip.tsx    # Theme toggle with tooltip
└── index.ts                      # UI components export
```

**Purpose**: Reusable, themable UI primitives following design system principles.

#### Admin Components (`components/admin/`)

```
src/components/admin/
├── ActivityLog.tsx               # Activity log viewer
├── AdminUserRegistrationModal.tsx # User registration modal
├── AdvancedFilters.tsx           # Advanced filtering UI
├── ClassDetailView.tsx           # Class detail view
├── CreateHODModal.tsx            # Create HOD modal
├── CSVImportModal.tsx            # CSV import modal
├── DetailCard.tsx                # Detail card component
├── EmptyState.tsx                # Empty state placeholder
├── ExportButtons.tsx             # Export action buttons
├── FilterSection.tsx             # Filter section component
├── HODDetailView.tsx             # HOD detail view
├── ManagementPageLayout.tsx      # Management page layout
├── PaginatedTable.tsx            # Paginated table component
├── QuickActionPanel.tsx          # Quick action panel
├── StudentDetailView.tsx         # Student detail view
├── SystemAlerts.tsx              # System alerts component
└── TeacherDetailView.tsx         # Teacher detail view
```

**Purpose**: Admin-specific components for user management, class management, and administrative tasks.

#### Authentication Components (`components/auth/`)

```
src/components/auth/
├── fields/                       # Form field components
│   ├── AuthDatePicker.tsx
│   ├── AuthErrorBanner.tsx
│   ├── AuthInput.tsx
│   ├── AuthMultiSelect.tsx
│   ├── AuthSelect.tsx
│   ├── AuthSubmitButton.tsx
│   ├── AuthSuccessBanner.tsx
│   ├── index.ts
│   └── TenantSelector.tsx
├── layout/                       # Auth layout components
│   ├── AuthFormLayout.tsx
│   └── index.ts
├── AuthModal.tsx                 # Authentication modal
├── AuthPanel.tsx                 # Authentication panel
├── FormSection.tsx               # Form section wrapper
├── HealthBanner.tsx              # Health status banner
├── LoginForm.tsx                 # Login form component
└── RegisterForm.tsx              # Registration form component
```

**Purpose**: Authentication UI components, forms, and layouts.

#### SuperUser Components (`components/superuser/`)

```
src/components/superuser/
├── investigations/               # Investigation components
│   ├── InvestigationCaseMetadata.tsx
│   ├── InvestigationDetailsPanel.tsx
│   ├── InvestigationListTable.tsx
│   ├── InvestigationResolutionPanel.tsx
│   ├── InvestigationTimeline.tsx
│   └── index.ts
├── reports/                      # Report components
│   ├── ReportBuilder.tsx
│   ├── ReportViewer.tsx
│   ├── ScheduledReportsManager.tsx
│   └── ScheduleReportModal.tsx
├── shared/                       # Shared SuperUser components
│   ├── AuditDetailsModal.tsx
│   ├── DateRangeFilter.tsx
│   ├── DeviceInfoCell.tsx
│   ├── MetadataCell.tsx
│   ├── SearchAndFilterBar.tsx
│   └── TagsCell.tsx
├── index.ts
├── LoginAttemptsViewer.tsx        # Login attempts viewer
├── LoginHistoryViewer.tsx        # Login history viewer
├── PasswordHistoryViewer.tsx     # Password history viewer
├── PasswordManagementModal.tsx   # Password management modal
├── PlatformAuditLogViewer.tsx    # Platform audit log viewer
├── SessionManager.tsx            # Session management component
├── SessionMap.tsx                # Session map visualization
├── TenantSwitcher.tsx            # Tenant switcher component
└── UserActivityTimeline.tsx      # User activity timeline
```

**Purpose**: SuperUser-specific components for platform management, investigations, and audits.

#### Other Component Categories

```
src/components/
├── billing/                      # Billing components
│   ├── InvoiceList.tsx
│   └── SubscriptionCard.tsx
├── charts/                       # Chart components
│   ├── BarChart.tsx
│   ├── LineChart.tsx
│   ├── PieChart.tsx
│   └── StatCard.tsx
├── dataManagement/               # Data management components
│   ├── BackupManager.tsx
│   └── GdprManager.tsx
├── landing/                      # Landing page components
│   ├── __tests__/
│   │   └── top-schools.test.tsx
│   └── TopSchools.tsx
├── layout/                       # Layout components
│   ├── DashboardHeader.tsx
│   ├── LandingFooter.tsx
│   ├── LandingHeader.tsx
│   └── RouteMeta.tsx
├── profile/                      # Profile components
│   ├── ActivityHistory.tsx
│   ├── AuditLogs.tsx
│   ├── FileUploads.tsx
│   ├── PasswordChangeModal.tsx
│   ├── PasswordChangeSection.tsx
│   ├── ProfileLayout.tsx
│   └── ProfileSection.tsx
├── shared/                       # Shared components
│   ├── DeviceInfoBadge.tsx
│   ├── FormModal.tsx
│   ├── index.ts
│   ├── MetadataViewer.tsx
│   ├── PermissionDenied.tsx
│   └── TimelineStepper.tsx
├── sso/                          # SSO components
│   └── SsoProviderManager.tsx
├── student/                      # Student components
│   ├── __tests__/
│   │   └── StudentStatCard.test.tsx
│   ├── AnnouncementCard.tsx
│   ├── StudentResourceCard.tsx
│   └── StudentStatCard.tsx
├── support/                      # Support components
│   ├── AnnouncementBanner.tsx
│   ├── KnowledgeBase.tsx
│   ├── MessageCenter.tsx
│   ├── StatusPage.tsx
│   └── TicketList.tsx
├── table-actions/                # Table action components
│   ├── ActionButtonGroup.tsx
│   ├── AssignButton.tsx
│   ├── DeleteButton.tsx
│   ├── EditButton.tsx
│   ├── ExportButton.tsx
│   ├── index.ts
│   └── ViewButton.tsx
├── teacher/                      # Teacher components
│   ├── __tests__/
│   │   └── TeacherQuickActions.test.tsx
│   ├── AnnouncementForm.tsx
│   ├── ResourceUploadModal.tsx
│   ├── TeacherClassCard.tsx
│   └── TeacherQuickActions.tsx
├── atoms/                        # Atomic design atoms
│   └── index.ts
├── molecules/                    # Atomic design molecules
│   └── index.ts
├── organisms/                    # Atomic design organisms
│   └── index.ts
├── tables/                       # Table components
│   └── DataTable.tsx
├── ATOMIC_DESIGN.md              # Atomic design documentation
├── DatePicker.tsx                # Date picker (legacy)
├── ProtectedRoute.tsx            # Route protection component
└── Table.tsx                     # Table component (legacy)
```

**Purpose**: Feature-specific and reusable components organized by domain and design pattern.

---

### Layouts (`layouts/`)

```
src/layouts/
├── AdminShell.tsx                # Admin dashboard layout shell
├── AuthLayout.tsx                # Authentication layout
├── DashboardLayout.tsx           # Generic dashboard layout
├── LandingShell.tsx              # Public landing page layout
└── SuperuserLayout.tsx           # SuperUser dashboard layout shell
```

**Purpose**: Layout wrappers that provide consistent structure, navigation, and theming for different sections of the application.

---

### Context (`context/`)

```
src/context/
├── AuthContext.tsx               # Authentication context (user, tokens, login/logout)
└── DashboardRouteContext.tsx     # Dashboard route context (page metadata)
```

**Purpose**: React Context providers for global state management (authentication, routing metadata).

---

### Hooks (`hooks/`)

#### Custom Hooks

```
src/hooks/
├── useApi.ts                     # API client hook
├── useAsyncFeedback.ts           # Async operation feedback hook
├── useAuth.ts                    # Authentication hook
├── useAuthForm.ts                # Auth form management hook
├── useBulkOperations.ts          # Bulk operations hook
├── useButtonAction.ts            # Button action handler hook
├── useCSVImport.ts                # CSV import hook
├── useDataLoader.ts              # Data loading hook
├── useDebounce.ts                # Debounce utility hook
├── useExport.ts                  # Export functionality hook
├── useFetchEntity.ts             # Entity fetching hook
├── useFileUpload.ts              # File upload hook
├── useFilters.ts                 # Filter management hook
├── useLoginForm.ts               # Login form hook
├── useManagementPage.ts          # Management page hook
├── usePagination.ts              # Pagination hook
├── usePermission.ts              # Permission checking hook
├── useProfileData.ts             # Profile data hook
├── useProfileSync.ts              # Profile synchronization hook
├── useQuery.ts                   # Query hook wrapper
├── useRegisterForm.ts            # Registration form hook
├── useSidebar.ts                 # Sidebar state hook
├── useTenant.ts                  # Tenant management hook
├── useWebSocket.ts               # WebSocket connection hook
└── index.ts                      # Hooks export
```

#### React Query Hooks (`hooks/queries/`)

```
src/hooks/queries/
├── admin/                        # Admin query hooks
│   ├── index.ts
│   ├── useAdminClasses.ts
│   ├── useAdminDashboard.ts
│   ├── useAdminReports.ts
│   ├── useAdminUsers.ts
│   ├── useAnnouncements.ts
│   └── useDepartments.ts
├── dashboard/                    # Dashboard query hooks
│   ├── index.ts
│   ├── queryConfig.ts
│   ├── queryKeys.ts
│   ├── useActiveSessionsQuery.ts
│   ├── useClassStatsQuery.ts
│   ├── useLoginAttemptsQuery.ts
│   ├── useRecentActivityQuery.ts
│   ├── useStudentStatsQuery.ts
│   ├── useSubjectStatsQuery.ts
│   ├── useTeacherStatsQuery.ts
│   └── useTodayAttendanceQuery.ts
├── hod/                          # HOD query hooks
│   ├── index.ts
│   ├── useHodDashboard.ts
│   ├── useHodDepartmentReport.ts
│   └── useHodTeachers.ts
├── useActivityLogs.ts            # Activity logs query
├── useAdminQueries.ts            # Admin queries wrapper
├── useBilling.ts                 # Billing queries
├── useClasses.ts                 # Classes queries
├── useDashboardData.ts           # Dashboard data queries
├── useDashboardQueries.ts        # Dashboard queries wrapper
├── useDashboardStats.ts          # Dashboard statistics queries
├── useHODs.ts                    # HOD queries
├── useInvestigationCases.ts      # Investigation cases queries
├── useNotifications.ts           # Notifications queries
├── useSearch.ts                  # Search queries
├── useStudentPhase7.ts           # Student Phase 7 queries
├── useStudents.ts                # Students queries
├── useSuperuserQueries.ts        # SuperUser queries wrapper
├── useTeacherPhase7.ts           # Teacher Phase 7 queries
├── useTeachers.ts                # Teachers queries
└── useTerms.ts                   # Terms queries
```

**Purpose**: Custom React hooks for data fetching, state management, and business logic encapsulation.

---

### Libraries (`lib/`)

#### API Layer (`lib/api/`)

```
src/lib/api/
├── pagination.ts                 # Pagination utilities
└── api.ts                        # Main API client (typed fetch wrapper)
```

**Purpose**: Centralized API client with type safety, error handling, and token management.

#### RBAC (`lib/rbac/`)

```
src/lib/rbac/
├── filterSidebarLinks.ts         # Sidebar link filtering by role
├── permissions.ts                # Permission definitions
├── roleConfig.ts                 # Role configuration
└── useRBAC.ts                    # RBAC hook
```

**Purpose**: Role-based access control utilities and hooks.

#### Security (`lib/security/`)

```
src/lib/security/
├── csrf.ts                       # CSRF token management
├── inputSanitization.ts          # Input sanitization utilities
├── rules.ts                      # Security rules
└── tokenSecurity.ts              # Token security utilities
```

**Purpose**: Security utilities for CSRF protection, input sanitization, and token management.

#### State Management (`lib/store/`)

```
src/lib/store/
├── contrastStore.ts              # High contrast mode store (Zustand)
├── tenantStore.ts                # Tenant state store (Zustand)
├── themeStore.ts                 # Theme state store (Zustand)
└── uiStore.ts                    # UI state store (Zustand)
```

**Purpose**: Zustand stores for global state management (theme, tenant, UI state).

#### Theme (`lib/theme/`)

```
src/lib/theme/
├── highContrast.ts               # High contrast mode utilities
├── theme.ts                      # Theme configuration
└── useTheme.ts                   # Theme hook
```

**Purpose**: Theming utilities and hooks for light/dark mode and high contrast.

#### Utilities (`lib/utils/`)

```
src/lib/utils/
├── animations.ts                 # Animation utilities
├── charts.ts                     # Chart utilities
├── cn.ts                         # Class name utility (clsx + tailwind-merge)
├── data.ts                       # Data manipulation utilities
├── date.ts                       # Date formatting utilities
├── export.ts                     # Export utilities
├── formatters.ts                 # Data formatters
├── index.ts                      # Utils export
├── responsive.ts                 # Responsive utilities
├── status.ts                     # Status utilities
└── userHelpers.ts                # User helper functions
```

**Purpose**: Reusable utility functions for common operations.

#### Other Libraries

```
src/lib/
├── apiResponseUtils.ts           # API response utilities
├── errorMapper.ts                # Error mapping utilities
├── react-query.ts                # React Query configuration
├── roleLinks.tsx                 # Role-based navigation links
├── sanitize.ts                   # Input sanitization
├── userUtils.ts                  # User utility functions
└── validators/
    └── authSchema.ts             # Authentication validation schema (Zod)
```

**Purpose**: Additional library utilities for API handling, validation, and business logic.

---

### Configuration (`config/`)

```
src/config/
└── permissions.ts                # Permission configuration
```

**Purpose**: Configuration files for permissions and other settings.

---

### Styles (`styles/`)

```
src/styles/
├── global.css                    # Global styles
└── theme/                        # Theme styles
    ├── [theme files].css
    └── [theme files].css
```

**Purpose**: Global CSS styles and theme-specific stylesheets.

---

### Types (`types/`)

```
src/types/
└── auth.ts                       # Authentication type definitions
```

**Purpose**: TypeScript type definitions for authentication and other domains.

---

### Utils (`utils/`)

```
src/utils/
└── formatters.ts                 # Formatter utilities (legacy)
```

**Purpose**: Legacy utility functions (prefer `lib/utils/` for new code).

---

### Tests (`__tests__/`)

```
src/__tests__/
├── accessibility.test.tsx        # Accessibility tests (axe-core)
├── adminConfig.test.tsx          # Admin config tests
├── adminOverview.phase2.test.tsx # Admin overview Phase 2 tests
├── adminReports.test.tsx         # Admin reports tests
├── adminRoles.test.tsx          # Admin roles tests
├── attendance.test.tsx           # Attendance tests
├── auth-flow.test.tsx            # Authentication flow tests
├── authResponse-status.test.tsx  # Auth response status tests
├── exams.test.tsx                # Exams tests
├── fees.test.tsx                 # Fees tests
├── home.test.tsx                 # Home page tests
├── layout-shells.test.tsx        # Layout shell tests
├── loginRegister.integration.test.tsx # Login/register integration tests
├── protectedRoute-permissions.test.tsx # Protected route permission tests
├── quickActionPanel.test.tsx     # Quick action panel tests
├── registerForm.roleRendering.test.tsx # Register form role rendering tests
├── routing.test.tsx              # Routing tests
├── sidebar-behavior.test.tsx     # Sidebar behavior tests
├── student-sync.test.tsx         # Student sync tests
├── systemAlerts.test.tsx         # System alerts tests
├── useDashboardStats.test.tsx    # Dashboard stats hook tests
├── useLoginForm.test.tsx         # Login form hook tests
├── usePermission.test.tsx        # Permission hook tests
├── useRegisterForm.test.tsx      # Register form hook tests
└── userUtils.test.ts             # User utils tests
```

**Purpose**: Unit and integration tests using Vitest and Testing Library.

---

## E2E Tests (`e2e/`)

```
e2e/
├── admin-approve-teacher.spec.ts  # Admin approve teacher E2E test
├── superuser-create-school.spec.ts # SuperUser create school E2E test
├── superuser-security.spec.ts     # SuperUser security E2E test
├── teacher-grade-student.spec.ts  # Teacher grade student E2E test
└── README.md                      # E2E tests documentation
```

**Purpose**: End-to-end tests using Playwright for critical user flows.

---

## Configuration Files

```
frontend/
├── package.json                  # Dependencies, scripts, project metadata
├── package-lock.json             # Dependency lock file
├── pnpm-lock.yaml                # pnpm lock file
├── tsconfig.json                 # TypeScript compiler configuration
├── tsconfig.tests.json           # Test-specific TypeScript config
├── vite.config.ts                # Vite build configuration
├── vitest.setup.ts               # Vitest test environment setup
├── playwright.config.ts          # Playwright E2E test configuration
├── postcss.config.cjs            # PostCSS configuration
├── tailwind.config.cjs           # Tailwind CSS configuration
└── index.html                    # HTML entry point
```

---

## Key Architectural Patterns

### 1. **Component-Based Architecture**
- Atomic Design principles (atoms, molecules, organisms)
- Reusable UI primitives in `components/ui/`
- Feature-specific components organized by domain

### 2. **Role-Aware Routing**
- Separate layouts for different user roles
- Protected routes with permission checks
- Dynamic navigation based on user role

### 3. **State Management**
- React Context for global state (auth, theme)
- Zustand stores for UI state
- React Query for server state management

### 4. **Theming & Branding**
- BrandProvider for tenant-specific theming
- CSS variables for dynamic theming
- High contrast mode support
- Light/dark theme toggle

### 5. **Type Safety**
- TypeScript throughout
- Zod schemas for validation
- Typed API client

### 6. **Testing Strategy**
- Vitest for unit/integration tests
- Testing Library for component tests
- Playwright for E2E tests
- Accessibility testing with axe-core

---

## File Count Summary

- **Pages**: ~60+ page components
- **Components**: ~200+ component files
- **Hooks**: ~60+ custom hooks
- **React Query Hooks**: ~39 query hooks
- **Tests**: ~25 test files
- **E2E Tests**: 4 Playwright specs
- **Layouts**: 5 layout components
- **Context Providers**: 2 context providers

---

## Development Workflow

1. **Entry Point**: `main.tsx` → `App.tsx`
2. **Request Flow**: Component → Hook → API Client → Backend
3. **State Flow**: React Query Cache → Component State → UI
4. **Routing**: React Router → ProtectedRoute → Layout Shell → Page
5. **Theming**: BrandProvider → CSS Variables → Components

---

## Key Technologies

- **React 18**: UI library
- **TypeScript**: Type safety
- **Vite**: Build tool and dev server
- **React Router**: Client-side routing
- **React Query**: Server state management
- **Zustand**: Client state management
- **Tailwind CSS**: Utility-first CSS
- **Framer Motion**: Animation library
- **Zod**: Schema validation
- **Vitest**: Unit testing
- **Playwright**: E2E testing
- **Sonner**: Toast notifications
- **Lucide React**: Icon library

---

## Component Organization Principles

1. **Atomic Design**: Components organized by complexity (atoms → molecules → organisms)
2. **Feature-Based**: Components grouped by feature/domain (admin, student, teacher, etc.)
3. **Reusability**: UI primitives in `components/ui/` for maximum reuse
4. **Separation of Concerns**: Pages, components, hooks, and utilities clearly separated
5. **Accessibility**: WCAG compliance with axe-core testing

---

## Notes

- All components use TypeScript for type safety
- Lazy loading implemented for route-based code splitting
- BrandProvider enables tenant-specific theming
- ProtectedRoute ensures role-based access control
- React Query handles caching, refetching, and optimistic updates
- Zustand stores provide lightweight global state management
- Tailwind CSS enables rapid UI development with utility classes
- Vitest provides fast unit testing with excellent DX
- Playwright ensures critical user flows work end-to-end

---

*Last Updated: Based on current codebase structure*


