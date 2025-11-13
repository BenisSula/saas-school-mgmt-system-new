# Deployment Checklist – SaaS School Management Portal

## Pre-Deploy Validation
- [ ] Confirm `.env` mirrors production secrets: `VITE_API_BASE_URL`, `VITE_TENANT_ID` (optional), JWT secrets, Postgres URL, `CORS_ORIGIN`.
- [ ] Run `npm run build --prefix frontend` and `npm run build --prefix backend`.
- [ ] Execute automated suites:
  - [ ] `npm run test --prefix backend`
  - [ ] `npm run test --prefix frontend`
  - [ ] `npm run test:accessibility --prefix frontend`
- [ ] Review `docs/security-tests.md`, `docs/performance-audit.md`, and `docs/accessibility-report.md` for regressions.

## Infrastructure & Data
- [ ] Apply latest database migrations (`npm run migrate --prefix backend`).
- [ ] Backup production database snapshots (schema + tenant schemas).
- [ ] Verify monitoring/alerting dashboards (APM, logs, uptime).

## Frontend Artefact
- [ ] Upload `frontend/dist/` to CDN/static host (e.g., S3 + CloudFront, Netlify).
- [ ] Cache-bust assets (use Vite hashed filenames by default).
- [ ] Set HTTP caching headers and enable gzip/brotli.

## Backend & API
- [ ] Deploy compiled backend (`backend/dist/`) to target environment (container, serverless, etc.).
- [ ] Configure `CORS_ORIGIN` to include new frontend host(s).
- [ ] Ensure webhook endpoints (payments) are reachable and mocked providers disabled in prod if real provider configured.

## Post-Deploy Smoke Tests
- [ ] Login flows for all roles (student, teacher, admin, superadmin).
- [ ] Tenant switching with correct branding/theme application.
- [ ] Admin configuration (branding, terms, classes) read/write.
- [ ] Reports dashboards load data (attendance, grades, fees).
- [ ] Payments/invoices create + reconcile (mock or live provider).
- [ ] Inspect browser console/network for 4xx/5xx and CORS issues.

## Sign-off
- [ ] Update `CHANGELOG.md` with release summary.
- [ ] Tag release in VCS and create deployment ticket notes.
- [ ] Communicate release status to stakeholders and schedule monitoring window.


