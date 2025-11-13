# Frontend Layout Map

## Routing & Shells
- `frontend/src/main.tsx`
  - Bootstraps React with `BrowserRouter`, `BrandProvider`, `AuthProvider`, and global `Toaster`.
- `frontend/src/App.tsx`
  - Handles top-level routing via React Router.
  - `/` renders `LandingShell` with the marketing `HomePage`.
  - `/dashboard/*` wraps protected routes in `AdminShell`; computes navigation links by user role and redirects to a default dashboard tab after login.

## Landing experience
- `frontend/src/layouts/LandingShell.tsx`
  - Marketing shell composed of `LandingHeader`, content area, and `LandingFooter`.
  - Accepts `onShowAuth` callback for CTA buttons to toggle login/register modes.
- `frontend/src/components/layout/LandingHeader.tsx`
  - Branding, marketing anchors (smooth-scroll), theme toggle, and sign-in CTA.
- `frontend/src/components/layout/LandingFooter.tsx`
  - Footer leveraging brand tokens for consistent styling.
- `frontend/src/pages/LandingPage.tsx`
  - Pure presentational component rendering single-page sections (Hero, About, Features, Pricing, Top Schools, Contact) with landmarks.
  - Provides CTA buttons and reusable scroll helpers; consumes optional `children` slot for auth panel.
- `frontend/src/pages/index.tsx`
  - Former landing implementation; now delegates layout to `LandingPage` while injecting the login/register panel via the children slot and wiring `onModeChange` to `AuthContext` actions.
- `frontend/src/components/landing/TopSchools.tsx`
  - Fetches top school data from `api.getTopSchools`, handles loading/error/empty states, and renders branded cards.

## Dashboard experience
- `frontend/src/layouts/AdminShell.tsx`
  - Dashboard layout with `DashboardHeader`, responsive `Sidebar`, and `Outlet` for nested routes.
- `frontend/src/components/layout/DashboardHeader.tsx`
  - Wraps the shared `Navbar`, supplying authenticated user data and sidebar toggles.
- `frontend/src/components/ui/Navbar.tsx`
  - Shared header for dashboard views; receives filtered nav links from `App.tsx`.
- `frontend/src/components/ui/Sidebar.tsx`
  - Collapsible navigation rail that renders links supplied by `AdminShell`.

## Theming & Auth
- `frontend/src/components/ui/BrandProvider.tsx`
  - Fetches tenant branding, applies CSS variables, manages light/dark mode through `ThemeToggle`.
- `frontend/src/context/AuthContext.tsx`
  - Manages login, registration, refresh token scheduling, and logout; exposes state via `useAuth()`.
- `frontend/src/lib/api.ts`
  - Typed API client handling token headers, refresh flow, and input sanitisation. Now exports `getTopSchools` helper and `TopSchool` DTO.

## Shared UI
- `frontend/src/components/ui/*`
  - Button, Input, Select, DatePicker, Table, Modal, StatusBanner, ThemeToggle, etc.
  - Landing and dashboard share the same UI primitives through branding tokens.

## Testing
- `frontend/src/__tests__/layout-shells.test.tsx`
  - Verifies `LandingShell` does not render dashboard controls and `AdminShell` mounts the sidebar/header.
- `frontend/src/components/landing/__tests__/top-schools.test.tsx`
  - Mocks the API client to cover loading, error, and empty states for the Top Schools widget.
- Existing page/component tests remain unchanged but now run within the new router-led architecture.

