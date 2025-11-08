# SaaS School Management System

Monorepo scaffold for the SaaS School Management Portal. Phase 1 delivered project scaffolding; Phase 2 adds secure authentication, JWT sessions, and role-based access control across Student/Teacher/Admin/SuperAdmin personas. Phase 3 introduces schema-per-tenant onboarding, migrations, and request-scoped tenant resolution. Phase 4 layers on tenant-aware CRUD services for students, teachers, branding, and school profile. Phase 5 introduces attendance tracking APIs and UI stubs for teachers and students. Phase 6 adds exam scheduling, grade entry, ranking logic, and CSV/PDF export flows for tenant results. Phase 7 introduces fee invoicing and payment tracking with a pluggable provider abstraction plus new fee dashboards. **Phase 8** delivers admin configuration, reporting endpoints, and live React admin tooling (branding, academic calendar, RBAC management, and multi-module reports).

## Project Structure

- `backend/` – Express + TypeScript API with auth routes, RBAC middleware, Postgres connection helper, tenant onboarding utilities, tenant CRUD services, and database migrations.
- `frontend/` – Vite + React + TypeScript app with Tailwind CSS, layout/component stubs, and smoke test.
- `docs/` – Discovery phase documentation and user stories.
- `.github/workflows/ci.yml` – CI pipeline that runs linting and tests for both apps.

## Requirements

- Node.js 20+
- npm 10+
- Docker & Docker Compose (for local infra)

## Getting Started (Local)

1. **Install dependencies**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Copy environment template**
   ```bash
   cp .env.example .env
   ```
   Adjust values as needed (e.g., database connection string, API base URL).

3. **Run database migrations (first time)**
   ```bash
   npm run migrate --prefix backend
   ```

4. **Run backend locally**
   ```bash
   npm run dev --prefix backend
   ```

5. **Run frontend locally**
   ```bash
   npm run dev --prefix frontend
   ```
   The frontend points to the backend via `VITE_API_URL` (defaults to `http://localhost:3001`). You can also configure `VITE_TENANT_ID` (default `tenant_alpha`) and `VITE_API_TOKEN` if you want the browser to send a pre-generated bearer token while manual auth flows are still being wired.

## Docker Compose

Spin up Postgres, backend, and frontend with one command:

```bash
docker compose up --build
```

Services:
- `db`: Postgres 16 with persistent volume.
- `backend`: Express API watching for changes (`npm run dev`).
- `frontend`: Vite dev server exposed on port 5173.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run lint --prefix backend` | Lints backend TypeScript files. |
| `npm run test --prefix backend` | Runs backend Jest suites (auth, tenant, CRUD routes). |
| `npm run lint --prefix frontend` | Lints frontend using ESLint + React plugins. |
| `npm run test --prefix frontend` | Runs frontend tests (Vitest + Testing Library). |
| `npm run migrate --prefix backend` | Applies shared Postgres migrations (shared and tenant templates). |
| `npm run format:write --prefix backend` | Formats backend files with Prettier. |
| `npm run format:write --prefix frontend` | Formats frontend files with Prettier. |
| `docker compose up --build` | Local Postgres + backend + frontend stack. |

## Husky & Lint-Staged

Husky enforces linting and tests before commits. After installing dependencies at the repo root (see below), hooks run automatically.

## Repository Root Tooling

Install root tooling (Husky, lint-staged, concurrently) and enable Git hooks:

```bash
npm install
npm run prepare
```

## Tenant Bootstrapping (Local)

1. Start Docker Compose to provision Postgres.
2. Ensure `DATABASE_URL` uses the schema-per-tenant pattern (e.g., `postgres://.../saas_school?schema=tenant_xyz` in future phases).
3. SuperAdmins can call `POST /tenants` to provision new tenants (creates schema, runs tenant migrations, seeds branding). Use `x-tenant-id` header (or subdomain) with tenant-aware endpoints that require schema context.

## Tenant Management (Phase 3)

- `db/tenantManager.ts` exposes helpers to create tenant schemas, run tenant migrations (`backend/src/db/migrations/tenants`), and seed default data.
- `middleware/tenantResolver.ts` resolves tenant context from `x-tenant-id` header or host subdomain, attaches `req.tenant`, and scopes queries by adjusting `search_path`.
- `GET /tenants/current/branding` (requires auth) returns tenant-specific branding data to confirm schema isolation.
- Tests (`tenantManager.test.ts`) ensure tenant creation, seeding, and cross-tenant isolation.

## Authentication API (Phase 2)

- `POST /auth/signup` – Create user (SuperAdmin or tenant-scoped role). Response contains access + refresh tokens.
- `POST /auth/login` – Exchange credentials for tokens.
- `POST /auth/refresh` – Rotate refresh token and mint new access token.
- `POST /auth/request-password-reset` / `POST /auth/reset-password` – Password recovery flow (tokens logged to console locally).
- `POST /auth/request-email-verification` / `POST /auth/verify-email` – Email verification stubs (tokens logged).
- Protected resources call `authenticate` middleware and `requirePermission` to enforce centralized permissions (`config/permissions.ts`). Tokens embed `tenant_id` to guarantee isolation.

- Minimal OpenAPI document: `backend/openapi.yaml`

## Core CRUD APIs (Phase 4)

- `GET/POST/PUT/DELETE /students`
- `GET/POST/PUT/DELETE /teachers`
- `GET/PUT /branding`
- `GET/PUT /school`
- Validation powered by Zod (`studentValidator`, `teacherValidator`, `brandingValidator`, `schoolValidator`).
- Business logic isolated in `services/` modules; controllers stay thin.
- Jest coverage in `studentRoutes.test.ts` and `teacherBrandingRoutes.test.ts`.

- Attendance APIs (Phase 5):
  - `POST /attendance/mark` (bulk, idempotent)
  - `GET /attendance/{studentId}` (history + summary)
  - `GET /attendance/report/class?class_id=&date=`
  - Teacher UI stub: `TeacherAttendancePage`
  - Student UI stub: `StudentAttendancePage`
- Examination module (Phase 6):
  - `POST /exams`, `POST /exams/{examId}/sessions`
  - `POST /grades/bulk` with centralized audit logging & grade boundaries
  - `GET /results/{studentId}?exam_id=` for aggregates, ranking, and grade summaries
  - `GET /results/{examId}/export?format=csv|pdf` for downloadable result sheets
  - Frontend stubs: `TeacherGradeEntryPage`, `StudentResultsPage`, `AdminExamConfigPage`
- Fee management (Phase 7):
  - `POST /invoices`, `GET /invoices/{studentId}`
  - `POST /payments` webhook with idempotent persistence and invoice reconciliation
  - Payment provider abstraction (`services/payments/provider.ts`) for Stripe/Paystack/Mollie drop-ins
  - Frontend stubs: `StudentFeesPage`, `AdminInvoicePage`
  - Jest coverage in `feeRoutes.test.ts`

- Admin configuration & reporting (Phase 8):
  - `GET/PUT /configuration/branding`, `GET/POST /configuration/terms`, `GET/POST /configuration/classes`
  - `GET /reports/attendance`, `GET /reports/grades?exam_id=`, `GET /reports/fees?status=`
  - `GET /users`, `PATCH /users/{userId}/role` for tenant RBAC management
  - React admin hub at `/frontend/src/App.tsx` with live pages: `AdminConfigurationPage`, `AdminReportsPage`, `AdminRoleManagementPage`
  - Vitest coverage in `adminConfig.test.tsx`, `adminReports.test.tsx`, and `adminRoles.test.tsx`
  - New backend integration tests: `configRoutes.test.ts`, `reportRoutes.test.ts`, `userRoutes.test.ts`
  - Reusable Tailwind component library in `frontend/src/components/ui/` covering Button, Input, Select, DatePicker, Modal, Table, Navbar, Sidebar, and a `BrandProvider` that hydrates CSS variables from tenant branding. Component usage examples live in `frontend/src/components/ui/examples/ExamplesGallery.tsx`.

## Testing

```bash
# Backend
npm run test --prefix backend

# Frontend
npm run test --prefix frontend
```

CI replicates these commands for pull requests.

## Next Steps

- Integrate real email/SMS providers for verification & reset flows.
- Flesh out production-ready frontend routing/state (React Router + TanStack Query).
- Add tenant onboarding automation (`POST /tenants`) and schema provisioning CLI.
- Integrate live exam data sources, teacher-class permissions, and production payment providers.
- Implement automated tenant backups, retention policies, and observability dashboards.
- Expand the UI component gallery into Storybook with visual regression coverage and contrast/keyboard audits.

