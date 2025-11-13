# Safe Change Plan – Phase 2

## Completed actions
- [x] Refactored `App.tsx` to use React Router with separate shells (`LandingShell`, `AdminShell`).
- [x] Introduced dedicated headers/footers:
  - `LandingHeader` / `LandingFooter` for marketing pages.
  - `DashboardHeader` wrapping the existing `Navbar` for dashboards.
- [x] Implemented `layouts/LandingShell.tsx` and `layouts/AdminShell.tsx`.
  - Admin shell now renders the responsive sidebar and consumes filtered nav links.
- [x] Removed the legacy `MainLayout` and ensured landing content uses the new shell.
- [x] Added `layout-shells.test.tsx` to guarantee shells render the expected navigation elements.
- [x] Verified lint, unit, accessibility, and production builds post-refactor.

## Notes
- CTA buttons on the landing header use `onShowAuth` to surface login/register panels without touching dashboard navigation.
- Future clean-up: consider retiring the legacy button/table re-export files once consumers adopt the UI kit imports directly.

