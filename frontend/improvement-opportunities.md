# Improvement Opportunities (Phase 1 Findings)

## Architecture & Routing
- **Lack of router**: `App.tsx` uses local state to switch views. Introduce React Router (v6+) with lazy-loaded routes for maintainability, deep-linking, and guard support.
- **Context separation**: `BrandProvider` handles data fetching, token derivation, and DOM side-effects in one component. Consider splitting into a data hook (possibly cached via React Query) and a presentation provider for cleaner responsibility boundaries.
- **Missing auth/session context**: No shared authentication state, route protection, or token refresh logic on the frontend.

## State & Data Fetching
- **Manual fetch + setState**: Pages directly call `api.*` and manage loading/message state themselves. Adopting React Query/SWR would provide caching, retry, and request deduplication.
- **Duplicated notification logic**: `AdminConfigurationPage`, `AdminReportsPage`, and `AdminRoleManagementPage` all implement local `message` + `statusType`. Centralize via a reusable alert/toast system.
- **No optimistic updates / error boundaries**: User role changes and branding updates rely on manual state updates without global error handling.

## UI/UX Consistency
- **Navbar/Sidebar**: Basic layout, no theme toggle, no user avatar menu, no lucide icons or tooltips. Should align with “world-class” requirement.
- **Page transitions**: No motion/animation; opportunities to add framer-motion transitions and respect reduced-motion preferences.
- **Form inputs**: Repeated label/input/error patterns could be wrapped into reusable form field components with validation hints.
- **Tables**: Table component lacks pagination, sorting, empty-state illustrations, and responsiveness enhancements.

## Accessibility
- **Keyboard focus management**: Sidebar overlay requires focus trapping when open; modal handles this but other components do not.
- **ARIA attributes**: Some button-only links (e.g., nav items) rely purely on text without `aria-current`; add descriptive metadata.
- **Form helpers**: Inputs use labels but do not expose validation status (e.g., `aria-invalid` already there, but no `aria-describedby` for success messages).

## Performance
- **No code splitting**: Pages are bundled together; naive initial bundle.
- **Potential re-renders**: `navLinks` array recreated on every render (mitigated by `useMemo`, but dependencies still cause re-renders). Components like `Sidebar` could be memoized with `React.memo`.
- **Branding fetch**: Runs on mount without caching; rapid toggling or multiple mounts would re-fetch.

## Security & Robustness
- **Auth integration missing**: No login/register consumption, insecure token handling (env token). Need proper login flow, secure storage, and header injection via interceptor.
- **Data sanitization**: API responses rendered without escape/validation (especially metadata fields like `branding.theme_flags`).
- **Tenant management**: `DEFAULT_TENANT` env fallback may be incorrect for multi-tenant production; should derive from session or host mapping.

## Documentation & Testing
- **Docs**: No README section describing theming flow, route structure, or component usage. Needs update once refactor complete.
- **Testing gaps**: Stubs lack tests; landing page tests only check simple renders. Need coverage for navbar/sidebar interactions, BrandProvider failure states, etc.
- **Tooling**: No automated accessibility tests or Lighthouse checks integrated.

## Styling
- **Repeated Tailwind strings**: Common class combinations (e.g., `rounded-md border bg-slate-950 ...`) appear across inputs/selects; could be extracted into utility classes or `cn()` helper with shadcn conventions.
- **No theme toggle**: Dark mode only; requirement includes light/dark toggle using Tailwind `dark` variants.


