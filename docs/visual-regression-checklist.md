# Visual Regression Checklist - Phase D1

**Date:** 2025-11-24  
**Phase:** D1 - UI/UX Refactoring

## Purpose
This checklist ensures visual consistency after UI refactoring. Take screenshots at each breakpoint after implementing changes.

## Breakpoints to Test

- **Mobile**: `<= 480px` (320px, 375px, 480px)
- **Tablet**: `640px - 1023px` (640px, 768px, 1024px)
- **Desktop**: `>= 1024px` (1024px, 1280px, 1440px, 1920px)

## Pages to Screenshot

### Admin Pages
- [ ] `/admin/dashboard` - Dashboard overview
- [ ] `/admin/users` - User management table
- [ ] `/admin/classes` - Classes management
- [ ] `/admin/departments` - Departments management
- [ ] `/admin/teachers` - Teachers management
- [ ] `/admin/students` - Students management
- [ ] `/admin/reports` - Reports page

### Teacher Pages
- [ ] `/teacher/dashboard` - Teacher dashboard
- [ ] `/teacher/attendance` - Attendance marking
- [ ] `/teacher/classes` - Class management

### Student Pages
- [ ] `/student/dashboard` - Student dashboard
- [ ] `/student/results` - Results view
- [ ] `/student/attendance` - Attendance view

### HOD Pages
- [ ] `/hod/dashboard` - HOD dashboard
- [ ] `/hod/reports` - Department reports

## Component Screenshots

### UI Components
- [ ] Button (all variants: solid, outline, ghost)
- [ ] Input (text, multiline, with icons)
- [ ] Modal (small, medium, large)
- [ ] Table (with data, empty state)
- [ ] Badge (all status variants)
- [ ] Card (with hover effects)
- [ ] StatusBanner (all status types)

### Layout Components
- [ ] DashboardLayout (with sidebar collapsed/expanded)
- [ ] ManagementPageLayout (with filters, export buttons)
- [ ] Responsive grid layouts

## Visual Checks

### Typography
- [ ] Headings use Poppins font
- [ ] Body text uses Roboto font
- [ ] Font sizes scale correctly on mobile
- [ ] Line heights are appropriate

### Colors
- [ ] Primary color (#234E70) appears correctly
- [ ] Secondary color (#F5A623) appears correctly
- [ ] Accent color (#1ABC9C) appears correctly
- [ ] Color contrast meets WCAG AA standards

### Spacing
- [ ] Consistent spacing scale (4, 8, 12, 16, 24, 32px)
- [ ] Cards have consistent padding
- [ ] Sections have appropriate gaps
- [ ] Mobile spacing is not too tight

### Responsive Behavior
- [ ] Mobile: Single column layout
- [ ] Tablet: 2-column layout where appropriate
- [ ] Desktop: Multi-column layout
- [ ] Sidebar collapses on mobile
- [ ] Tables scroll horizontally on mobile
- [ ] Buttons stack vertically on mobile when needed

### Grid Layouts
- [ ] CSS Grid used instead of Flexbox where appropriate
- [ ] Grid gaps are consistent
- [ ] Grid columns adapt to screen size
- [ ] No horizontal overflow on mobile

## Before/After Comparison

### Before Screenshots Location
- Store in `docs/screenshots/before-d1/`

### After Screenshots Location
- Store in `docs/screenshots/after-d1/`

### Comparison Tools
- Use visual diff tools (Percy, Chromatic, or manual comparison)
- Check for:
  - Layout shifts
  - Color changes
  - Font changes
  - Spacing changes
  - Broken responsive layouts

## Test Commands

```bash
# Run Playwright visual tests
cd frontend
npm run test:e2e

# Take manual screenshots at different viewports
# Use browser DevTools responsive mode
```

## Critical Areas

1. **Admin Dashboard** - Complex layout with multiple cards
2. **User Management Table** - Large table with filters
3. **Mobile Navigation** - Sidebar behavior
4. **Form Layouts** - Input alignment and spacing
5. **Modal Dialogs** - Centering and responsive behavior

## Notes

- All screenshots should be taken in both light and dark themes
- Test with actual data, not empty states only
- Verify accessibility (keyboard navigation, screen readers)
- Check browser console for errors

## Sign-off

- [ ] All screenshots taken
- [ ] Visual comparisons completed
- [ ] No regressions found
- [ ] Responsive behavior verified
- [ ] Accessibility maintained

---

**Last Updated:** 2025-11-24

