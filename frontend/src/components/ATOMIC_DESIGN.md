# Atomic Design Structure

This project follows **Atomic Design** principles for component organization.

## Structure

```
components/
├── atoms/          # Basic building blocks (Button, Input, Label)
├── molecules/      # Simple combinations (SearchBar, StatusBanner)
├── organisms/      # Complex components (Sidebar, Navbar, Forms)
└── ui/            # Legacy location (being migrated to atomic structure)
```

## Component Classification

### Atoms
**Basic building blocks that cannot be broken down further**

- `Button` - Interactive button element
- `Input` - Form input field
- `Select` - Dropdown select
- `StatusBadge` - Status indicator badge
- `Card` - Container card

### Molecules
**Simple combinations of atoms that form a functional unit**

- `SearchBar` - Search input with clear button
- `StatusBanner` - Status message banner
- `DatePicker` - Date selection input
- `Modal` - Dialog/modal overlay
- `ThemeToggle` - Theme switcher button
- `AvatarDropdown` - User avatar with dropdown menu

### Organisms
**Complex components made of molecules and atoms**

- `Sidebar` - Navigation sidebar
- `Navbar` - Top navigation bar
- `DashboardHeader` - Dashboard page header
- `DashboardSkeleton` - Loading skeleton
- `Notifications` - Notification system
- `Table` - Data table component

## Migration Status

**Current Status:** Components are being migrated from `ui/` folder to atomic structure.

**Import Strategy:** Use index files for clean imports:
- `import { Button } from '@/components/atoms'`
- `import { SearchBar } from '@/components/molecules'`
- `import { Sidebar } from '@/components/organisms'`

## Guidelines

1. **Atoms** should be single-purpose, reusable, and have no dependencies on other components
2. **Molecules** combine atoms to create simple functional units
3. **Organisms** combine molecules and atoms to create complex, page-level components
4. All components should use the `cn()` utility for class merging
5. Components should be responsive by default
6. All components should follow accessibility best practices

