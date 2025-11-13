# Changelog

All notable updates to the SaaS School Management System are tracked here.

## Phase 7 – QA, Accessibility & Handover (2025-11-08)
- Finalised landing vs dashboard separation with nested routing, `RouteMeta`, and accessible page titles.
- Rebuilt dashboard shell: static header + collapsible sidebar with per-role link mapping and persisted collapse state.
- Extended Vitest integration coverage (`routing.test.tsx`, `sidebar-behavior.test.tsx`) and ensured `pnpm lint`, `pnpm test`, `pnpm build` pass.
- Produced updated accessibility & performance reports, refreshed README (shells, approval workflow, theming), and documented pending-user approval process.

## Phase 6 – Security, Scalability & Final Testing (2025-11-08)
- Enforced env-driven API base URL and cleaned up tenant storage.
- Added axe-core accessibility smoke test and Vitest auth mocks.
- Installed `@types/cors`, extended backend auth test timeout, and documented security testing.

## Phase 5 – UI Polish & Accessibility (2025-11-07)
- Consolidated reusable UI kit under `frontend/src/components/ui`.
- Introduced ThemeToggle, responsive navigation, memoised tables, and lazy-loaded routes.
- Updated frontend tests and accessibility documentation.

## Phase 4 – Functionality Integration (2025-11-06)
- Connected frontend pages to live backend endpoints (auth, reports, role management, configuration).
- Added toast notifications, loading states, and ProtectedRoute wrappers.
- Implemented `AuthContext` with refresh token handling and `lib/api.ts` client.

## Phase 3 – UI/UX Modernisation (2025-11-04)
- Revamped navbar/sidebar with Framer Motion, theme-aware styling, and responsive behaviour.
- Added component gallery, theme tokens, and brand-aware UI primitives.

## Phase 2 – Architecture Refinement (2025-11-02)
- Refactored frontend to DRY up hooks and components (`useResponsiveSidebar`, shared API client).
- Centralised fetch logic and removed duplicate component implementations.

## Phase 1 – Codebase Investigation (2025-10-31)
- Documented frontend structure, dependencies, and improvement opportunities.
- Mapped backend endpoint usage from the initial client.

## Phase 0 – Discovery (2025-10-29)
- Captured requirements, SLAs, user stories, non-functional expectations, and integration points.
- Produced prioritised roadmap, acceptance criteria, and developer handoff checklist.


