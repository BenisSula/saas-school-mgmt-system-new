/**
 * BrandProvider Unit Tests
 * Tests for theme injection, CSS variables, and tenant branding
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { BrandProvider, useBrand } from '../components/ui/BrandProvider';
import type { BrandingConfig } from '../lib/api';
import * as api from '../lib/api';

// Mock API
vi.mock('../lib/api', () => ({
  api: {
    getBranding: vi.fn(),
  },
}));

// Mock tenant store
vi.mock('../lib/store/tenantStore', () => ({
  useTenantStore: () => ({
    previewTenantId: null,
    previewBranding: null,
    clearPreview: vi.fn(),
  }),
}));

// Mock auth context
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { role: 'admin', tenantId: 'tenant-1' },
  }),
}));

describe('BrandProvider', () => {
  beforeEach(() => {
    // Clear document head
    document.head.innerHTML = '';
    document.documentElement.style.cssText = '';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('applies default tokens when no branding is available', async () => {
    (api.api.getBranding as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    function TestComponent() {
      const { tokens } = useBrand();
      return <div data-testid="tokens">{JSON.stringify(tokens)}</div>;
    }

    render(
      <BrandProvider>
        <TestComponent />
      </BrandProvider>
    );

    await waitFor(() => {
      const styleElement = document.getElementById('tenant-branding-styles');
      expect(styleElement).toBeTruthy();
      expect(styleElement?.textContent).toContain('--brand-primary');
    });
  });

  it('applies CSS variables from branding config', async () => {
    const branding: BrandingConfig = {
      primary_color: '#FF0000',
      secondary_color: '#00FF00',
      accent_color: '#0000FF',
    } as BrandingConfig;

    (api.api.getBranding as ReturnType<typeof vi.fn>).mockResolvedValue(branding);

    render(
      <BrandProvider>
        <div>Test</div>
      </BrandProvider>
    );

    await waitFor(() => {
      const styleElement = document.getElementById('tenant-branding-styles');
      expect(styleElement?.textContent).toContain('--brand-primary: #FF0000');
      expect(styleElement?.textContent).toContain('--brand-secondary: #00FF00');
      expect(styleElement?.textContent).toContain('--brand-accent: #0000FF');
    });
  });

  it('applies font family from typography config', async () => {
    const branding: BrandingConfig = {
      typography: {
        fontFamily: 'CustomFont',
      },
    };

    (api.api.getBranding as ReturnType<typeof vi.fn>).mockResolvedValue(branding);

    render(
      <BrandProvider>
        <div>Test</div>
      </BrandProvider>
    );

    await waitFor(() => {
      const styleElement = document.getElementById('tenant-branding-styles');
      expect(styleElement?.textContent).toContain('--font-family-heading: CustomFont');
      expect(styleElement?.textContent).toContain('--font-family-base: CustomFont');
    });
  });

  it('applies favicon when provided', async () => {
    const branding: BrandingConfig = {
      favicon_url: 'https://example.com/favicon.ico',
    } as BrandingConfig;

    (api.api.getBranding as ReturnType<typeof vi.fn>).mockResolvedValue(branding);

    render(
      <BrandProvider>
        <div>Test</div>
      </BrandProvider>
    );

    await waitFor(() => {
      const faviconLink = document.querySelector('link[rel="icon"]');
      expect(faviconLink).toBeTruthy();
      expect(faviconLink?.getAttribute('href')).toBe('https://example.com/favicon.ico');
    });
  });
});
