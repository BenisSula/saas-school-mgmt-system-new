# Frontend Dependency Map

## Entry & Global Providers
- `main.tsx`
  - Imports global styles.
  - Wraps `<App />` with `<BrandProvider>` inside `React.StrictMode`.
- `components/ui/BrandProvider.tsx`
  - Fetches `/configuration/branding` via `lib/api.ts`.
  - Computes color tokens → writes CSS variables to `document.documentElement`.
  - Exposes `{ tokens, loading, error, refresh }`.

## Application Shell
- `App.tsx`
  - Local state: `view` (string union) and `sidebarOpen` (boolean).
  - Derives `activePage` component via `useMemo` switch.
  - Builds `navLinks: NavLink[]` for navigation.
  - Layout structure:
    - `<Navbar>` (passes brand name, nav links, sidebar toggle handler).
    - Overlay `<div>` for mobile sidebar closing.
    - `<Sidebar>` (passes nav links + close handler).
    - `<main>` renders `activePage`.
    - Footer shown when `view !== 'home'`.

## Layouts & Pages
- `layouts/MainLayout.tsx`
  - Consumes `useBrand()` tokens.
  - Provides marketing header/footer wrapper for landing page (`pages/index.tsx`).

- `pages/`
  - `index.tsx` (landing) → wrapped by `MainLayout`.
  - Admin modules (rendered inside App shell):
    - `AdminConfigurationPage.tsx`
      - Loads branding/terms/classes (`api.getBranding`, `listTerms`, `listClasses`).
      - Local state for form values & messaging.
      - Uses `Button`, `Input`, `DatePicker`, `Select`, `Table`.
    - `AdminReportsPage.tsx`
      - Calls `api.getAttendanceReport`, `getGradeReport`, `getFeeReport`.
      - Local state for filters, examId, feeStatus, message.
      - Uses same UI primitives.
    - `AdminRoleManagementPage.tsx`
      - Calls `api.listUsers`, `updateUserRole`.
      - Maps API data → `Table` rows with inline `Select`.
    - Other stubs (`AdminExamConfigPage`, `StudentFeesPage`, etc.) render static/demo data only.

## Reusable UI Components
- `components/ui/index.ts` re-exports primitives.
- `Navbar.tsx`
  - Depends on `Button`.
  - Receives `links: NavLink[]`, toggles for sidebar.
  - Uses CSS variables from `BrandProvider` (expects `--brand-*` defined globally).
- `Sidebar.tsx`
  - Depends on `Button`.
  - Receives same `NavLink[]`.
  - Uses `open` prop for transform classes; calls `onClose` on selection.
- `Table.tsx`
  - Accepts generic rows/columns.
  - Optional `caption`, `onRowClick`.
  - Uses brand CSS vars for header background.
- `Button.tsx`, `Input.tsx`, `Select.tsx`, `DatePicker.tsx`, `Modal.tsx`
  - Stateless wrappers using Tailwind classes.
  - `Modal` creates portal, handles ESC + focus trap.

## lib/api.ts Consumption
- Shared `apiFetch` attaches headers:
  - `x-tenant-id`
  - `Authorization` (optional env token)
  - `Content-Type` when body present.
- Exposed functions used by pages:
  - Branding: `getBranding`, `updateBranding`
  - Academic structure: `listTerms`, `createTerm`, `listClasses`, `createClass`
  - Reports: `getAttendanceReport`, `getGradeReport`, `getFeeReport`
  - RBAC: `listUsers`, `updateUserRole`
- No auth/login endpoints currently invoked from frontend.

## Tests
- `__tests__/admin*.test.tsx`
  - Mock `global.fetch` to assert API endpoints hit on interactions.
- `components/ui/__tests__`
  - Unit tests for `BrandProvider`, `Button`, `Modal`.

## High-Level Dependency Flow
```
main.tsx
 └── BrandProvider (fetches branding)
      └── App.tsx
           ├── Navbar (Button)
           ├── Sidebar (Button)
           └── Page components
                ├── AdminConfigurationPage
                │    ├── api.getBranding/listTerms/listClasses
                │    └── UI primitives (Input/Select/DatePicker/Table/Button)
                ├── AdminReportsPage
                │    ├── api.getAttendanceReport/getGradeReport/getFeeReport
                │    └── UI primitives (DatePicker/Input/Select/Table/Button)
                ├── AdminRoleManagementPage
                │    ├── api.listUsers/updateUserRole
                │    └── UI primitives (Table/Select/Button)
                └── Other page stubs (static content)
```


