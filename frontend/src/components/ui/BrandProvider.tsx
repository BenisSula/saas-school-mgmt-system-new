import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { api, type BrandingConfig } from '../../lib/api';

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
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const DEFAULT_TOKENS: BrandTokens = {
  primary: '#1d4ed8',
  primaryContrast: '#ffffff',
  secondary: '#0f172a',
  secondaryContrast: '#e2e8f0',
  accent: '#22d3ee',
  accentContrast: '#0f172a',
  surface: '#0f172a',
  surfaceContrast: '#f1f5f9',
  border: '#1f2937',
  muted: '#64748b'
};

const BrandContext = createContext<BrandContextValue>({
  tokens: DEFAULT_TOKENS,
  loading: false,
  error: null,
  refresh: async () => {}
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
    b: bigint & 255
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

function deriveTokens(branding?: BrandingConfig | null): BrandTokens {
  if (!branding) {
    return DEFAULT_TOKENS;
  }

  const primary = normalizeHex(branding.primary_color, DEFAULT_TOKENS.primary);
  const secondary = normalizeHex(branding.secondary_color, DEFAULT_TOKENS.secondary);

  const primaryContrast = contrastColor(primary);
  const secondaryContrast = contrastColor(secondary);

  return {
    primary,
    primaryContrast,
    secondary,
    secondaryContrast,
    accent: '#22d3ee',
    accentContrast: contrastColor('#22d3ee'),
    surface: '#0f172a',
    surfaceContrast: '#f1f5f9',
    border: '#1f2937',
    muted: '#64748b'
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
    ['--brand-muted', tokens.muted]
  ];
  entries.forEach(([key, value]) => root.style.setProperty(key, value));
}

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [tokens, setTokens] = useState<BrandTokens>(DEFAULT_TOKENS);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBranding = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const branding = await api.getBranding();
      setTokens(deriveTokens(branding));
    } catch (err) {
      setError((err as Error).message);
      setTokens(DEFAULT_TOKENS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchBranding();
      } catch {
        if (!cancelled) {
          setTokens(DEFAULT_TOKENS);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchBranding]);

  useEffect(() => {
    applyCssVariables(tokens);
  }, [tokens]);

  const value = useMemo<BrandContextValue>(
    () => ({
      tokens,
      loading,
      error,
      refresh: fetchBranding
    }),
    [tokens, loading, error, fetchBranding]
  );

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand(): BrandContextValue {
  return useContext(BrandContext);
}


