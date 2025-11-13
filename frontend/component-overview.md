# Component Overview

## Core Providers & Context
- **BrandProvider (`components/ui/BrandProvider.tsx`)**
  - Responsibilities: fetch tenant branding, derive a consistent token set, persist via CSS variables, expose refresh.
  - Consumers: `main.tsx`, `MainLayout`, all UI primitives via CSS vars, tests in `components/ui/__tests__/brandProvider.test.tsx`.
  - Observations: Handles both data fetch and theme computation in one component (could be split for caching vs rendering).

## Application Shell
- **App (`App.tsx`)**
  - Local state for view switching rather than router.
  - Composes `Navbar`, overlay, `Sidebar`, dynamic pages, and admin footer.
  - Maintains nav link metadata (label, handler, active flag).
- **Navbar (`components/ui/Navbar.tsx`)**
  - Mobile menu button, horizontal nav links, "back to top" button.
  - Relies on parent for `brandName`, `links`, and toggling state.
- **Sidebar (`components/ui/Sidebar.tsx`)**
  - Re-uses same `links` to render vertical menu.
  - Handles close action on link selection; responsive transform classes.
- **MainLayout (`layouts/MainLayout.tsx`)**
  - Dedicated layout for marketing pages; uses brand tokens for background/border colors.

## UI Primitives
- **Button / Input / Select / DatePicker / Modal / Table (`components/ui/`)**
  - Tailwind-based, stateless.
  - Input & Select display label, helper text, error status.
  - Table is generic with optional caption and row click handler.
  - Modal manages focus trap & portal.
  - `components/Button.tsx`, `components/Table.tsx`, `components/DatePicker.tsx` simply re-export these.

## Pages
- **Landing Page (`pages/index.tsx`)**
  - Marketing hero + CTA using `MainLayout`.
- **AdminConfigurationPage**
  - Shows current branding tokens, form to update colors/theme flags.
  - Additional forms to create academic terms and classes.
  - Message banner for success/error; uses shared UI primitives and `Table`.
  - Local state duplicates similar patterns (loading flag, message, status type).
- **AdminReportsPage**
  - Filter forms for attendance, grade, fee reports.
  - Results displayed in `Table`; uses same message structure as configuration page.
  - Manual CSV download via `downloadJson`.
- **AdminRoleManagementPage**
  - Displays tenant users in table; inline `Select` to change role.
  - `loadUsers` reused on refresh button click.
- **Other Pages (AdminExamConfigPage, AdminInvoicePage, Student/Teacher pages)**
  - Currently static stubs with placeholder content/tables.

## Utilities & Tests
- **lib/api.ts**
  - Centralized fetch helper with tenant + auth headers.
  - Exports typed functions for each backend endpoint in use (configuration, reports, users).
- **Tests**
  - Page-level tests in `__tests__/` ensure fetch calls triggered.
  - Component-level tests validate UI primitives.

## Styling & Assets
- Tailwind classes throughout; relies on CSS variables from BrandProvider for brand colors.
- Global styles imported via `styles/global.css`.

## Observed Patterns
- Many pages share the same pattern: fetch -> local state -> message banner -> Table, but each reimplements message handling.
- Navigation relies on manual state rather than router.
- UI primitives lack integration with shadcn/ui or lucide-react even though project intends to use them.
- No dedicated error boundary or loading boundary component.


