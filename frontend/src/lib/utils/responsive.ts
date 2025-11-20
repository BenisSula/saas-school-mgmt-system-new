/**
 * Responsive utility functions and constants
 * Provides consistent responsive breakpoints and helpers
 */

/**
 * Responsive breakpoints (matches Tailwind defaults)
 */
export const breakpoints = {
  xs: 475,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536
} as const;

/**
 * Responsive spacing scale
 */
export const spacing = {
  xs: '0.5rem', // 8px
  sm: '0.75rem', // 12px
  md: '1rem', // 16px
  lg: '1.5rem', // 24px
  xl: '2rem', // 32px
  '2xl': '3rem', // 48px
  '3xl': '4rem' // 64px
} as const;

/**
 * Responsive typography scale
 */
export const typography = {
  xs: {
    fontSize: '0.75rem', // 12px
    lineHeight: '1rem' // 16px
  },
  sm: {
    fontSize: '0.875rem', // 14px
    lineHeight: '1.25rem' // 20px
  },
  base: {
    fontSize: '1rem', // 16px
    lineHeight: '1.5rem' // 24px
  },
  lg: {
    fontSize: '1.125rem', // 18px
    lineHeight: '1.75rem' // 28px
  },
  xl: {
    fontSize: '1.25rem', // 20px
    lineHeight: '1.75rem' // 28px
  },
  '2xl': {
    fontSize: '1.5rem', // 24px
    lineHeight: '2rem' // 32px
  },
  '3xl': {
    fontSize: '1.875rem', // 30px
    lineHeight: '2.25rem' // 36px
  },
  '4xl': {
    fontSize: '2.25rem', // 36px
    lineHeight: '2.5rem' // 40px
  }
} as const;

/**
 * Get responsive value based on breakpoint
 */
export function getResponsiveValue<T>(
  values: Partial<Record<keyof typeof breakpoints, T>>,
  defaultValue: T
): T {
  if (typeof window === 'undefined') return defaultValue;

  const width = window.innerWidth;

  if (width >= breakpoints['2xl'] && values['2xl']) return values['2xl'];
  if (width >= breakpoints.xl && values.xl) return values.xl;
  if (width >= breakpoints.lg && values.lg) return values.lg;
  if (width >= breakpoints.md && values.md) return values.md;
  if (width >= breakpoints.sm && values.sm) return values.sm;
  if (width >= breakpoints.xs && values.xs) return values.xs;

  return defaultValue;
}

/**
 * Check if current viewport matches breakpoint
 */
export function useBreakpoint(breakpoint: keyof typeof breakpoints): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= breakpoints[breakpoint];
}
