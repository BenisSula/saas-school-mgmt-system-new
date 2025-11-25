import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, type BrandingConfig } from '../../lib/api';

export type ThemeMode = 'light' | 'dark';

export interface BrandTokens {
  primary: string;
  primaryContrast: string;
  secondary: string;
  secondaryContrast: string;
  accent: string;
  accentContrast: string;
  surface: string;
  surfaceContrast: string;
  border: string;
  muted: string;
}

interface BrandContextValue {
  tokens: BrandTokens;
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const THEME_STORAGE_KEY = 'saas-theme-preference';

const DEFAULT_SURFACE_TOKENS: Record<
  ThemeMode,
  Pick<BrandTokens, 'surface' | 'surfaceContrast' | 'border' | 'muted'>
> = {
  light: {
    surface: '#f8fafc',
    surfaceContrast: '#0f172a',
    border: '#cbd5f5',
    muted: '#475569',
  },
  dark: {
    surface: '#0f172a',
    surfaceContrast: '#f1f5f9',
    border: '#1f2937',
    muted: '#64748b',
  },
};

const DEFAULT_TOKENS: BrandTokens = {
  primary: '#1d4ed8',
  primaryContrast: '#ffffff',
  secondary: '#0f172a',
  secondaryContrast: '#e2e8f0',
  accent: '#22d3ee',
  accentContrast: '#0f172a',
  ...DEFAULT_SURFACE_TOKENS.dark,
};

const BrandContext = createContext<BrandContextValue>({
  tokens: DEFAULT_TOKENS,
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
  loading: false,
  error: null,
  refresh: async () => {},
});

function normalizeHex(color?: string | null, fallback: string = '#000000'): string {
  if (!color) return fallback;
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed) || /^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.length === 4
      ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
      : trimmed;
  }
  return fallback;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHex(hex);
  const bigint = parseInt(normalized.slice(1), 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const a = [r, g, b].map((v) => {
    const channel = v / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function contrastColor(hex: string): string {
  return luminance(hex) > 0.55 ? '#0f172a' : '#ffffff';
}

function deriveTokens(branding: BrandingConfig | null, theme: ThemeMode): BrandTokens {
  const surfaceTokens = DEFAULT_SURFACE_TOKENS[theme];
  const primary = normalizeHex(branding?.primary_color, DEFAULT_TOKENS.primary);
  const secondary = normalizeHex(branding?.secondary_color, DEFAULT_TOKENS.secondary);

  const primaryContrast = contrastColor(primary);
  const secondaryContrast = contrastColor(secondary);

  return {
    primary,
    primaryContrast,
    secondary,
    secondaryContrast,
    accent: '#22d3ee',
    accentContrast: contrastColor('#22d3ee'),
    ...surfaceTokens,
  };
}

function applyCssVariables(tokens: BrandTokens) {
  const root = document.documentElement;
  const entries: Array<[string, string]> = [
    ['--brand-primary', tokens.primary],
    ['--brand-primary-contrast', tokens.primaryContrast],
    ['--brand-secondary', tokens.secondary],
    ['--brand-secondary-contrast', tokens.secondaryContrast],
    ['--brand-accent', tokens.accent],
    ['--brand-accent-contrast', tokens.accentContrast],
    ['--brand-surface', tokens.surface],
    ['--brand-surface-contrast', tokens.surfaceContrast],
    ['--brand-border', tokens.border],
    ['--brand-muted', tokens.muted],
  ];
  entries.forEach(([key, value]) => root.style.setProperty(key, value));
}

// Note: Theme application is handled by lib/theme/theme.ts
// This function only sets the data-theme attribute for BrandProvider's theme mode
function applyBrandTheme(theme: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.setProperty('color-scheme', theme);
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'dark';
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
  return prefersDark ? 'dark' : 'light';
}

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [tokens, setTokens] = useState<BrandTokens>(() => deriveTokens(null, getInitialTheme()));
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBranding = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const brandingResponse = await api.getBranding();
      setBranding(brandingResponse);
      setTokens(deriveTokens(brandingResponse, theme));
    } catch (err) {
      setBranding(null);
      setError((err as Error).message);
      setTokens(deriveTokens(null, theme));
    } finally {
      setLoading(false);
    }
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchBranding();
      } catch {
        if (!cancelled) {
          setTokens(deriveTokens(null, theme));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchBranding, theme]);

  useEffect(() => {
    const nextTokens = deriveTokens(branding, theme);
    setTokens(nextTokens);
  }, [branding, theme]);

  useEffect(() => {
    applyCssVariables(tokens);
  }, [tokens]);

  useEffect(() => {
    applyBrandTheme(theme);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  }, [theme]);

  const handleSetTheme = useCallback((mode: ThemeMode) => {
    setTheme(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo<BrandContextValue>(
    () => ({
      tokens,
      theme,
      setTheme: handleSetTheme,
      toggleTheme,
      loading,
      error,
      refresh: fetchBranding,
    }),
    [tokens, theme, handleSetTheme, toggleTheme, loading, error, fetchBranding]
  );

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand(): BrandContextValue {
  return useContext(BrandContext);
}
