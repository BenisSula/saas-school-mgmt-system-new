# Improvement Request – Backend support for Top 5 Schools widget

## Summary
To power the new landing page “Top 5 Schools” section, the frontend needs an unauthenticated endpoint to retrieve the leading schools across tenants. The current backend only exposes tenant-scoped `/school` CRUD operations and lacks a cross-tenant ranking feed.

## Requested API
- **Endpoint:** `GET /schools/top`
- **Query params:**
  - `limit` (optional, default `5`, max e.g. `10`)
- **Response:**
```json
[
  {
    "id": "uuid",
    "name": "Example High",
    "logo_url": "https://cdn.example.com/logos/example-high.png",
    "metric_label": "Active students",
    "metric_value": 1240,
    "case_study_url": "https://example.com/case-studies/example-high"
  }
]
```
- **Behavior:**
  - Returns the `limit` highest-ranked schools ordered by usage metric (e.g., active students, uptime, or engagement score).
  - Public/unauthenticated (landing page). If sensitive, allow a read-only API key or hard-coded sampling data.
  - Cached to avoid heavy DB load (e.g., 15-minute cache).

## Rationale
- Landing page now has a “Top 5 Schools” widget to showcase real customers and metrics.
- Current backend lacks any cross-tenant list; only tenant admins can fetch their own school profile via authenticated `/school` route.
- Without this endpoint, the frontend would have to hard-code data, defeating the purpose of dynamic content.

## Suggested Implementation Notes
- Add a new controller under `backend/src/routes/publicSchools.ts` (unauthenticated).
- Introduce a service (e.g., `publicSchoolService.ts`) that queries aggregated metrics from analytics tables or precomputed materialized view.
- Allow fallbacks: if no live metrics available, return curated sample records (configurable via environment variable or seeded table).
- Include simple rate limiting on the route to prevent abuse.

Providing this endpoint will unblock the landing page widget and improve marketing credibility.

---

# Improvement Request – User status & approval endpoints

## Summary
Phase 4 introduces a pending-approval workflow for teacher and student sign-ups. The current backend lacks user status tracking and admin approval endpoints, so the frontend cannot complete the required flow.

## Requested Changes
- **Database**
  - Add `status` column to `shared.users` (`ENUM('pending','active','suspended','rejected')`, default `'pending'` for non-admin roles, `'active'` for admin/superadmin-created accounts).
- **Auth Responses**
  - Include `status` in responses from `/auth/signup`, `/auth/login`, and `/auth/refresh`.
  - Return 403 with message “Account pending admin approval.” when login attempted for pending users, without issuing tokens.
- **Admin Endpoints**
  - `GET /users?status=pending` – list pending users for tenant.
  - `PATCH /users/:id/approve` – mark user as `active`; returns updated record.
  - `PATCH /users/:id/reject` – mark user as `rejected` (optional `reason` payload); returns updated record.
  - Update existing `/users` endpoints to include `status` in payloads.
- **Security**
  - Restrict approve/reject routes to `admin` and `superadmin`.
  - Log approval/rejection events for audit.

## Rationale
- Frontend now blocks login for non-active accounts and surfaces pending requests to admins.
- Without backend status/state, registrations auto-login, violating the approval requirement.
- Dedicated admin endpoints are necessary so admins can activate pending users and unblock their access.

## Suggested Implementation Notes
- Migration to add `status` column with `DEFAULT 'pending'`.
- Update `signUp` service to set default status by role (admins active immediately, others pending).
- Adjust `login` service to reject non-active accounts before issuing tokens.
- Add new controllers under `backend/src/routes/users.ts` (or separate `approvals.ts`) with tenant-aware queries.
- Consider notifying users via email (placeholder stub) upon approval/rejection.
