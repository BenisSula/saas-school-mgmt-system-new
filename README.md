# SaaS School Management System

This monorepo powers the SaaS School Management Portal and tracks the incremental delivery phases (Phase 0 discovery → Phase 9 polish). The backend provides a schema-per-tenant Express API, while the frontend delivers a branded, role-aware React experience backed by reusable UI primitives.

---

## Monorepo Layout

| Path | Purpose |
| ---- | ------- |
| `backend/` | Express + TypeScript API, RBAC middleware, tenant onboarding, migrations, Jest suites. |
| `frontend/` | Vite + React + TypeScript client with Tailwind UI kit, BrandProvider theming, Vitest suites, and axe-core checks. |
| `docs/` | Discovery artifacts, deployment checklist, performance & accessibility audits, security notes. |
| `.github/workflows/ci.yml` | CI pipeline blueprint (lint + test for backend and frontend). |

Frontend structure highlights:

- `src/App.tsx` – role-aware shell with responsive navbar + sidebar, nested routing, and lazy-loaded dashboards.
- `src/layouts/LandingShell.tsx` / `src/layouts/AdminShell.tsx` – separate marketing vs authenticated experiences with appropriate landmarks (`header`/`main`/`footer`).
- `src/context/AuthContext.tsx` – handles access/refresh tokens, tenant persistence, auto-refresh schedule, and pending-user gating.
- `src/lib/api.ts` – typed client with sanitised request helpers, token lifecycle management, and tenant-aware headers.
- `src/components/ui/` – reusable themable primitives (Button, Input, Modal, Table, Navbar, Sidebar, ThemeToggle, BrandProvider, AvatarDropdown, DashboardSkeleton).
- `src/lib/roleLinks.tsx` – central mapping of persona → sidebar navigation definition.
- `src/pages/` – dashboards for each persona (admin configuration, reports, RBAC, teacher grades/attendance, student results/fees) plus auth/landing flows.

---

## Landing vs Dashboard Shells

- `LandingShell` wraps all marketing routes (`/`, `/auth/*`), exposes hero anchors for About/Features/Pricing sections, and never mounts dashboard UI.
- `AdminShell` is rendered only after authentication via `ProtectedRoute`. It wires:
  - `DashboardHeader` – static brand badge, dynamic page title supplied by `DashboardRouteProvider`, theme toggle, avatar dropdown (profile/settings/logout).
  - `Sidebar` – collapsible, keyboard accessible, remembers collapse state per user (`localStorage`).
  - `DashboardSkeleton` fallback around lazy-loaded routes.
  - `RouteMeta` helper so each route sets its header title/description without duplicating navigation.
- `getSidebarLinksForRole` ensures each persona sees the correct navigation set:
  - **Admin/Superadmin:** Dashboard, Users, Configuration, Reports, Fees, Exams, Branding.
  - **Teacher:** Dashboard, Class Roster, Attendance, Grade Entry, Exams.
  - **Student:** Dashboard, Attendance, Results, Fees.

## Authentication & Admin Approval Flow

- Public visitors hit `/` (marketing) or `/auth/login|register`.
- `AuthContext`:
  - hydrates refresh tokens + tenant ID from storage,
  - refreshes access tokens on a rolling schedule,
  - blocks login for users whose `status !== 'active'` (pending, suspended, rejected),
  - shows “Account pending admin approval” toast/banners when applicable.
- Landing CTA → Login/Register modal sequence is handled through `/auth/*` routes; successful register returns pending status for teachers/students.
- Admins/Superadmins manage pending accounts inside the **Users** dashboard tab:
  - `api.listPendingUsers`, `api.approveUser`, `api.rejectUser` drive the workflow.
  - UI provides approve/reject buttons with optimistic updates and toasts.

### Auth quick start

```tsx
const { login, register, user, logout } = useAuth();

await login({ email, password });           // only succeeds if status === 'active'
await register({ email, password, role });  // returns pending+toast for teacher/student
// Pending users can be viewed and approved under /dashboard/users
```

## Theming & BrandProvider

`frontend/src/components/ui/BrandProvider.tsx` fetches tenant branding (`/configuration/branding`), normalises colour tokens, and writes them to CSS variables (`--brand-*`). The provider also:

- Persists light/dark preference in `localStorage` via `ThemeToggle`.
- Exposes `useBrand()` hook with tokens, load state, and `refresh()` util.
- Ensures every UI primitive (buttons, tables, navbar, sidebar) reads brand tokens instead of hard-coding colours.

To override branding per tenant:

```ts
await api.updateBranding({
  primary_color: '#2563eb',
  secondary_color: '#0f172a',
  theme_flags: { gradients: true }
});
await refresh(); // from useBrand()
```

---

## API Integration Guide

The typed `api` client (in `src/lib/api.ts`) centralises fetch logic, error handling, sanitisation, and retries.

Key helpers:

- `apiFetch` – attaches `Authorization` + `x-tenant-id`, retries once on 401 via refresh token.
- `setTenant` – validates tenant slug (`^[a-zA-Z0-9_-]+$`) before persisting.
- `sanitizeText` / `sanitizeIdentifier` (`src/lib/sanitize.ts`) – strip unsafe characters before sending to backend.

Usage pattern:

```ts
const { history, summary } = await api.getStudentAttendanceHistory(
  user.id,
  filters.from,
  filters.to
);

await api.bulkUpsertGrades(examId, entries.map((entry) => ({
  ...entry,
  studentId: sanitizeIdentifier(entry.studentId)
})));
```

When adding new endpoints:
1. Define Zod schema server-side.
2. Add typed function to `src/lib/api.ts` (re-use `apiFetch`).
3. Consume via hooks/pages, sanitising input before send.
4. Extend Vitest suite or add axe tests if UI changes.

---

## Local Development

| Step | Command |
| ---- | ------- |
| Install backend deps | `npm install --prefix backend` |
| Install frontend deps | `npm install --prefix frontend` |
| Bootstrap env | `cp .env.example .env` |
| Run migrations | `npm run migrate --prefix backend` |
| Start backend | `npm run dev --prefix backend` (port 3001) |
| Start frontend | `npm run dev --prefix frontend` (port 5173/5175) |

> ℹ️ When the backend boots in `NODE_ENV=development` it now auto-seeds the demo tenant unless `AUTO_SEED_DEMO=false`. You can still run the script manually via `npm run demo:seed --prefix backend` if you prefer explicit control.

### Demo Accounts

After starting the stack you can log in with:

- **SuperUser:** `owner.demo@platform.test` / `OwnerDemo#2025`
- **Admin:** `admin.demo@academy.test` / `AdminDemo#2025`
- **Teacher:** `teacher.demo@academy.test` / `TeacherDemo#2025`
- **Student:** `student.demo@academy.test` / `StudentDemo#2025`

All demo accounts live on the generated tenant and are marked verified, so the dashboards load immediately for UI/UX reviews across roles.

Environment variables of note:

- `VITE_API_BASE_URL` (required) – API origin for the frontend build.
- `EMAIL_PROVIDER` – Email service provider (`console`, `smtp`, or `ses`). See `docs/email-provider-setup-guide.md` for configuration.
- `VITE_TENANT_ID` (optional) – default tenant when storage empty.
- `CORS_ORIGIN` – comma-separated origins backend allows.
- If you access the Vite dev server from a different host/port (for example `https://localhost:5173` or your LAN IP), add that origin to `CORS_ORIGIN` when starting the backend, or rely on the built-in localhost/127.0.0.1 allowances.
- JWT secrets, token TTLs, Postgres connection – see `.env.example` for defaults.

### Docker Compose

```bash
docker compose up --build
```
Services: Postgres 16 (`db`), hot-reloading backend, Vite dev server.

---

## Build, QA & CI/CD Readiness

- Frontend build: `npm run build --prefix frontend` (runs `tsc` + `vite build`). Produces `frontend/dist/` ready for static hosting.
- Backend build: `npm run build --prefix backend` (compiles to `backend/dist/`).
- Test suites:
  - Backend: `npm run test --prefix backend` (Jest integration/unit).
  - Frontend: `pnpm test --filter frontend` or `npm run test --prefix frontend` (Vitest + Testing Library + axe smoke).
  - Accessibility regression: included in Vitest suite (`src/__tests__/accessibility.test.tsx`).
  - Manual QA: landing anchors, login/register, admin approvals, role dashboards, sidebar collapse (see `docs/accessibility-report.md` / `docs/performance-report.md`).
- Pre-commit: Husky + lint-staged auto-run after `npm install` at repo root.
- Suggested CI stages: install → lint (`npm run lint --prefix ...`) → unit/integration tests → accessibility smoke → `npm run build --prefix frontend` → upload static artefact (optionally run Lighthouse in CI if Chrome available).

---

## Documentation & Checklists

- `CHANGELOG.md` – running summary of major releases (Phases 0–7+).
- `docs/deployment-checklist.md` – go-live checklist (envs, builds, back-ups, observability, smoke tests).
- `docs/security-tests.md` – commands + results for security-oriented testing.
- `docs/accessibility-report.md` + `docs/performance-report.md` – latest axe/Lighthouse findings and remediation notes.

See `CHANGELOG.md` for historical phase milestones and `docs/deployment-checklist.md` before any production deployment.

