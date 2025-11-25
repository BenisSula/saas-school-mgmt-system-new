/**
 * Responsive utilities and breakpoints
 * Centralized responsive design helpers
 */

export const breakpoints = {
  xs: '0px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px'
} as const;

export type Breakpoint = keyof typeof breakpoints;

/**
 * Media query helpers for use in components
 */
export const mediaQueries = {
  xs: `(min-width: ${breakpoints.xs})`,
  sm: `(min-width: ${breakpoints.sm})`,
  md: `(min-width: ${breakpoints.md})`,
  lg: `(min-width: ${breakpoints.lg})`,
  xl: `(min-width: ${breakpoints.xl})`,
  '2xl': `(min-width: ${breakpoints['2xl']})`
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
 * Typography scale for responsive design
 */
export const typography = {
  xs: { fontSize: '0.75rem', lineHeight: '1rem' }, // 12px
  sm: { fontSize: '0.875rem', lineHeight: '1.25rem' }, // 14px
  base: { fontSize: '1rem', lineHeight: '1.5rem' }, // 16px
  lg: { fontSize: '1.125rem', lineHeight: '1.75rem' }, // 18px
  xl: { fontSize: '1.25rem', lineHeight: '1.75rem' }, // 20px
  '2xl': { fontSize: '1.5rem', lineHeight: '2rem' }, // 24px
  '3xl': { fontSize: '1.875rem', lineHeight: '2.25rem' }, // 30px
  '4xl': { fontSize: '2.25rem', lineHeight: '2.5rem' } // 36px
} as const;
