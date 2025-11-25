# UI/UX Refactoring Plan - Phase D1

**Date:** 2025-11-24  
**Phase:** D1 - UI/UX Refactoring  
**Status:** ✅ **COMPLETED**

## 1. UI Primitives Audit

### Components Status

#### ✅ Canonical Components (No Duplicates Found)
- **Button**: `frontend/src/components/ui/Button.tsx` - Single canonical source
- **Input**: `frontend/src/components/ui/Input.tsx` - Single canonical source
- **Modal**: `frontend/src/components/ui/Modal.tsx` - Single canonical source
- **Badge**: `frontend/src/components/ui/Badge.tsx` - Single canonical source
- **AvatarDropdown**: `frontend/src/components/ui/AvatarDropdown.tsx` - Single canonical source
- **ThemeToggle**: `frontend/src/components/ui/ThemeToggle.tsx` - Single canonical source

#### ⚠️ Table Component (Already Wrapped)
- **Canonical**: `frontend/src/components/ui/Table.tsx`
- **Wrapper**: `frontend/src/components/Table.tsx` (re-exports from ui/Table)
- **Status**: ✅ Already using wrapper pattern - No action needed

#### 📁 Backup Folder
- `frontend_backup/` - Contains old backups, not used in active codebase
- **Action**: Can be ignored (not imported anywhere)

### Import Analysis

- **Button**: 89 files importing from `components/ui/Button` ✅
- **Table**: 21 files importing from `components/Table` or `components/ui/Table` ✅
- All imports are using canonical paths

## 2. Design Tokens Update

### Current State
- Theme file exists: `frontend/src/lib/theme/theme.ts`
- Current primary: `#234E70` ✅ (matches 3iAcademia)
- Current accent: `#1ABC9C` ✅ (matches 3iAcademia)
- **Missing**: Secondary color `#F5A623` (3iAcademia brand)

### Required Updates
1. Add Secondary color `#F5A623` to theme
2. Update Tailwind config to reference theme tokens
3. Ensure CSS variables are exported correctly

## 3. Responsive & Layout Rules

### Current Layout Components
- **DashboardLayout**: `frontend/src/layouts/DashboardLayout.tsx`
- **ManagementPageLayout**: `frontend/src/components/admin/ManagementPageLayout.tsx`

### Required Updates
1. Ensure CSS Grid with mobile-first breakpoints
2. Add explicit responsive tests
3. Verify breakpoints: `<= 480px` (mobile), `>= 1440px` (large)

## 4. Visual Consistency Tasks

### Spacing Scale
- **Current**: Using Tailwind defaults (4px base)
- **Required**: Standardize to 4, 8, 12, 16, 24, 32px scale
- **Action**: Update Tailwind config

### Typography
- **Required**: Poppins for headings, Roboto for body
- **Action**: Update theme.ts and CSS

### Inline Styles
- **Action**: Audit and replace with Tailwind classes

## 5. Component Migration Plan

### Status: ✅ No Migration Needed
- All components are already using canonical paths
- Table component already has wrapper pattern
- No duplicate components found in active codebase

### Wrapper Pattern (Example - Table)
```typescript
// frontend/src/components/Table.tsx
export { Table } from './ui/Table';
export type { TableColumn, TableProps } from './ui/Table';
```

## 6. Deliverables Checklist

- [x] ui-refactor-plan.md (this file)
- [ ] migration-log.json (minimal - only Table wrapper)
- [ ] Visual regression checklist
- [ ] Updated theme.ts with 3iAcademia colors
- [ ] Updated tailwind.config.cjs
- [ ] Responsive layout tests
- [ ] Typography standardization

## Next Steps

1. Update theme.ts with Secondary color
2. Update Tailwind config
3. Add responsive tests
4. Standardize spacing and typography
5. Create visual regression checklist

---

**Last Updated:** 2025-11-24

