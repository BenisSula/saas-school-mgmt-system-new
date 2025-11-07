# SaaS School Management System

Monorepo scaffold for the SaaS School Management Portal. Phase 1 includes backend and frontend skeletons, shared tooling, Docker-based local environment, and CI workflow hooks.

## Project Structure

- `backend/` – Express + TypeScript API skeleton with health route, RBAC middleware stub, and Postgres connection helper.
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

3. **Run backend locally**
   ```bash
   npm run dev --prefix backend
   ```

4. **Run frontend locally**
   ```bash
   npm run dev --prefix frontend
   ```
   The frontend points to the backend via `VITE_API_BASE_URL`.

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
| `npm run test --prefix backend` | Runs backend unit tests (Jest + ts-jest). |
| `npm run lint --prefix frontend` | Lints frontend using ESLint + React plugins. |
| `npm run test --prefix frontend` | Runs frontend tests (Vitest + Testing Library). |
| `npm run format:write --prefix backend` | Formats backend files with Prettier. |
| `npm run format:write --prefix frontend` | Formats frontend files with Prettier. |

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
3. Use future onboarding script (`POST /tenants`) to seed default roles and admin invite.

## Testing

```bash
# Backend
npm run test --prefix backend

# Frontend
npm run test --prefix frontend
```

CI replicates these commands for pull requests.

## Next Steps

- Implement actual RBAC, auth flows, and tenant provisioning services.
- Flesh out frontend routing and state management.
- Add database migration tooling and seed scripts.
- Extend tests to cover additional modules (attendance, exams, fees).

