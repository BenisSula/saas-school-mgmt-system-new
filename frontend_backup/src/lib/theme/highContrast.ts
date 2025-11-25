/**
 * High Contrast Mode Support
 * Provides utilities for enabling/disabling high contrast mode
 */

const HIGH_CONTRAST_STORAGE_KEY = 'saas-high-contrast';

export type ContrastMode = 'normal' | 'high';

/**
 * Get current contrast mode from localStorage or system preference
 */
export function getInitialContrastMode(): ContrastMode {
  if (typeof window === 'undefined') {
    return 'normal';
  }

  const stored = window.localStorage.getItem(HIGH_CONTRAST_STORAGE_KEY);
  if (stored === 'high' || stored === 'normal') {
    return stored;
  }

  // Check system preference
  if (window.matchMedia?.('(prefers-contrast: more)').matches) {
    return 'high';
  }

  return 'normal';
}

/**
 * Apply high contrast mode to document
 */
export function applyContrastMode(mode: ContrastMode) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  if (mode === 'high') {
    root.setAttribute('data-contrast', 'high');
  } else {
    root.removeAttribute('data-contrast');
  }

  // Store preference
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(HIGH_CONTRAST_STORAGE_KEY, mode);
  }
}

/**
 * Listen for system contrast preference changes
 */
export function initializeContrastMode(): () => void {
  if (typeof window === 'undefined') return () => {};

  const mediaQuery = window.matchMedia('(prefers-contrast: more)');
  const handleChange = () => {
    const stored = window.localStorage.getItem(HIGH_CONTRAST_STORAGE_KEY);
    // Only auto-apply if user hasn't set a preference
    if (!stored) {
      const mode = mediaQuery.matches ? 'high' : 'normal';
      applyContrastMode(mode);
    }
  };

  // Apply initial contrast mode
  const initialMode = getInitialContrastMode();
  applyContrastMode(initialMode);

  mediaQuery.addEventListener('change', handleChange);

  return () => {
    mediaQuery.removeEventListener('change', handleChange);
  };
}
