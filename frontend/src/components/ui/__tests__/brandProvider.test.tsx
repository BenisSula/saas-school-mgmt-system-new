import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { BrandProvider, useBrand } from '../BrandProvider';

vi.mock('../../../lib/api', () => ({
  api: {
    getBranding: vi.fn().mockResolvedValue({
      primary_color: '#000000',
      secondary_color: '#ffffff',
      logo_url: 'https://example.com/logo.png'
    })
  }
}));

import { api } from '../../../lib/api';

describe('BrandProvider', () => {
  beforeEach(() => {
    api.getBranding.mockClear();
  });

  it('loads branding tokens and exposes context', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BrandProvider>{children}</BrandProvider>
    );

    const { result } = renderHook(() => useBrand(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tokens.primary).toBe('#000000');
    expect(result.current.tokens.secondary).toBe('#ffffff');
    expect(api.getBranding).toHaveBeenCalled();
    expect(
      document.documentElement.style.getPropertyValue('--brand-primary').trim()
    ).toBe('#000000');
  });
});


