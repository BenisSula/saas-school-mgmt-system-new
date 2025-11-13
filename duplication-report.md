# Duplication / Conflict Report – Phase 2

## Resolved: Landing vs Dashboard Headers
- Dedicated shells now separate the experiences:
  - `LandingShell` (header/footer) for `/`.
  - `AdminShell` (Navbar + Sidebar) for `/dashboard/*`.
- The previous overlap where `App.tsx` always rendered the dashboard `Navbar` alongside `MainLayout` is removed.
- `frontend/src/layouts/MainLayout.tsx` has been deleted to avoid unused marketing header code.

## Remaining items to monitor
- Legacy shims `frontend/src/components/Button.tsx` and `frontend/src/components/Table.tsx` still re-export the UI-kit versions. Consolidating imports in a future pass would eliminate these wrappers.

No other layout duplications detected after the shell split.

