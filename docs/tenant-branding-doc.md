# Tenant Branding System Documentation

**Date:** 2025-11-24  
**Phase:** D3 - Tenant Branding System Upgrade

## Overview

The tenant branding system allows each tenant (school) to customize their visual identity within the platform, including colors, logos, fonts, and favicons. SuperUsers can preview tenant branding without switching context.

## Architecture

### Database Schema

The branding configuration is stored in the `branding_settings` table within each tenant schema:

```sql
CREATE TABLE {{schema}}.branding_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  accent_color TEXT,
  theme_flags JSONB DEFAULT '{}'::jsonb,
  typography JSONB DEFAULT '{}'::jsonb,
  navigation JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Migration

Migration file: `backend/src/db/migrations/tenants/031_add_tenant_branding_fields.sql`

This migration adds:
- `accent_color` column
- `favicon_url` column
- Ensures `typography` column exists

## API Endpoints

### Get Current Tenant Branding
```
GET /api/configuration/branding
```
Returns the branding configuration for the current tenant.

### Update Tenant Branding
```
PUT /api/configuration/branding
Body: {
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  typography?: {
    fontFamily?: string;
    headingWeight?: string;
    bodyWeight?: string;
  };
  navigation?: {
    style?: 'top' | 'side';
    showLogo?: boolean;
  };
}
```

### Get Tenant Branding (SuperUser Preview)
```
GET /api/superuser/schools/:id/branding
```
Returns the branding configuration for a specific tenant (SuperUser only).

## Frontend Components

### BrandProvider

Location: `frontend/src/components/ui/BrandProvider.tsx`

The `BrandProvider` component:
- Fetches branding configuration from the API
- Applies CSS variables to `:root` via a style element
- Loads custom fonts with preload and font-display swap
- Applies favicon
- Supports preview mode for SuperUsers

**Usage:**
```tsx
import { BrandProvider, useBrand } from './components/ui/BrandProvider';

function App() {
  return (
    <BrandProvider>
      {/* Your app */}
    </BrandProvider>
  );
}

function MyComponent() {
  const { tokens, branding, isPreviewMode } = useBrand();
  // Use tokens and branding
}
```

### TenantBrandingPreview

Location: `frontend/src/components/superuser/TenantBrandingPreview.tsx`

A component for SuperUsers to preview tenant branding:
- Select a tenant from a dropdown
- Load and preview their branding
- Shows preview banner when active
- Stores preview state in sessionStorage

**Usage:**
```tsx
import { TenantBrandingPreview } from './components/superuser/TenantBrandingPreview';

function SuperUserPage() {
  const { data: schools } = useQuery({
    queryKey: ['superuser', 'schools'],
    queryFn: () => api.superuser.listSchools(),
  });

  return (
    <TenantBrandingPreview schools={schools || []} />
  );
}
```

## Adding or Updating Tenant Branding

### Via API

1. **Get Current Branding:**
```typescript
const branding = await api.configuration.getBranding();
```

2. **Update Branding:**
```typescript
await api.configuration.updateBranding({
  primaryColor: '#234E70',
  secondaryColor: '#F5A623',
  accentColor: '#1ABC9C',
  logoUrl: 'https://cdn.example.com/logo.png',
  faviconUrl: 'https://cdn.example.com/favicon.ico',
  typography: {
    fontFamily: 'Poppins',
  },
});
```

### Via Admin UI

1. Navigate to `/admin/configuration`
2. Go to the Branding section
3. Update colors, upload logos, set fonts
4. Save changes

## Logo and Asset Management

### Static Assets

Logos can be stored in:
- `frontend/public/assets/logos/` (local)
- CDN URLs (recommended for production)

### Image Requirements

- **Logo:** Recommended size 200x200px, PNG or SVG
- **Favicon:** 32x32px or 16x16px, ICO or PNG
- **Format:** SVG preferred for scalability, PNG as fallback

### CDN Integration

For production, use CDN URLs:
```typescript
{
  logoUrl: 'https://cdn.yourschool.com/logo.svg',
  faviconUrl: 'https://cdn.yourschool.com/favicon.ico',
}
```

## Color Format

Colors should be provided in hex format:
- 3-digit: `#F5A`
- 6-digit: `#F5A623`

The system automatically:
- Normalizes 3-digit to 6-digit
- Calculates contrast colors for text
- Falls back to 3iAcademia defaults if invalid

## Font Loading

Custom fonts are loaded with:
- `rel="preload"` for performance
- `font-display: swap` to prevent invisible text
- Automatic fallback to system fonts

Supported font sources:
- Google Fonts (automatic)
- Custom font URLs (via typography.fontFamily)

## Preview Mode (SuperUser)

SuperUsers can preview tenant branding:

1. **Enable Preview:**
```typescript
import { useTenantStore } from '../lib/store/tenantStore';

const { setPreviewTenant } = useTenantStore();
const branding = await api.superuser.getTenantBranding(tenantId);
setPreviewTenant(tenantId, branding);
```

2. **Clear Preview:**
```typescript
const { clearPreview } = useTenantStore();
clearPreview();
```

3. **Check Preview Status:**
```typescript
const { isPreviewMode, previewTenantId } = useBrand();
```

**Safety:**
- Preview state is stored in `sessionStorage` (cleared on browser close)
- Preview does not alter tenant data
- Preview does not affect session tokens
- Preview is automatically cleared when user changes or is not superuser

## Brand-Safe Fallbacks

The system includes fallbacks to ensure consistent experience:

1. **Color Fallbacks:**
   - Primary: `#234E70` (3iAcademia brand)
   - Secondary: `#F5A623` (3iAcademia brand)
   - Accent: `#1ABC9C` (3iAcademia brand)

2. **Font Fallbacks:**
   - Headings: Poppins → system-ui → sans-serif
   - Body: Roboto → system-ui → sans-serif

3. **Logo Fallbacks:**
   - If logo URL fails to load, no logo is shown (graceful degradation)

## CSS Variables

The system injects the following CSS variables:

```css
:root {
  --brand-primary: #234E70;
  --brand-primary-contrast: #ffffff;
  --brand-secondary: #F5A623;
  --brand-secondary-contrast: #0f172a;
  --brand-accent: #1ABC9C;
  --brand-accent-contrast: #0f172a;
  --brand-surface: #0f172a;
  --brand-surface-contrast: #f1f5f9;
  --brand-border: #1f2937;
  --brand-muted: #64748b;
  --font-family-heading: Poppins, system-ui, sans-serif;
  --font-family-base: Roboto, system-ui, sans-serif;
}
```

## Testing

### Unit Tests

Location: `frontend/src/__tests__/brand-provider.test.tsx`

Tests cover:
- Default token application
- CSS variable injection
- Font family application
- Favicon application

### E2E Tests

To test preview mode:
1. Login as SuperUser
2. Navigate to SuperUser dashboard
3. Use TenantBrandingPreview component
4. Select a tenant
5. Verify branding is applied
6. Clear preview
7. Verify default branding restored

## Troubleshooting

### Branding Not Applying

1. Check browser console for errors
2. Verify API endpoint returns branding data
3. Check CSS variables in DevTools
4. Verify style element exists: `document.getElementById('tenant-branding-styles')`

### Preview Mode Not Working

1. Verify user is SuperUser
2. Check sessionStorage for `tenant-preview-state`
3. Verify `useTenantStore` is properly initialized
4. Check that `BrandProvider` is wrapping the app

### Fonts Not Loading

1. Verify font URL is accessible
2. Check CORS headers if using external fonts
3. Verify `font-display: swap` is applied
4. Check browser console for font loading errors

## Security Considerations

1. **Brand Isolation:** Each tenant's branding is isolated to their schema
2. **Preview Safety:** Preview mode does not modify tenant data
3. **URL Validation:** Logo and favicon URLs should be validated
4. **CORS:** Ensure CDN allows cross-origin requests for fonts

## Performance

1. **CSS Variables:** Applied via style element for fast updates
2. **Font Preloading:** Fonts are preloaded for better performance
3. **Lazy Loading:** Branding is fetched on component mount
4. **Caching:** Consider caching branding config on frontend

---

**Last Updated:** 2025-11-24

