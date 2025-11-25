/**
 * Theme hook for managing theme state
 */
import { useEffect } from 'react';
import { useThemeStore } from '../store/themeStore';
import { applyTheme, initializeTheme } from './theme';

/**
 * Hook for theme management
 */
export function useTheme() {
  const { theme, setTheme, getEffectiveTheme } = useThemeStore();

  useEffect(() => {
    // Initialize theme on mount
    const cleanup = initializeTheme();

    // Apply theme when it changes
    const effectiveTheme = getEffectiveTheme();
    applyTheme(effectiveTheme);

    return cleanup;
  }, [theme, getEffectiveTheme]);

  const effectiveTheme = getEffectiveTheme();

  return {
    theme,
    effectiveTheme,
    setTheme,
    toggleTheme: () => {
      const newTheme = effectiveTheme === 'light' ? 'dark' : 'light';
      setTheme(newTheme);
    },
    setLightTheme: () => setTheme('light'),
    setDarkTheme: () => setTheme('dark'),
    setSystemTheme: () => setTheme('system'),
  };
}
