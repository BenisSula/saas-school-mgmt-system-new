/**
 * Zustand store for theme state
 * Manages theme preference with system preference as default
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  getEffectiveTheme: () => 'light' | 'dark';
}

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'system', // Default to system preference
      setTheme: (theme) => {
        set({ theme });
        // Apply theme immediately
        const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;
        document.documentElement.setAttribute('data-theme', effectiveTheme);
        document.documentElement.style.colorScheme = effectiveTheme;
      },
      getEffectiveTheme: () => {
        const { theme } = get();
        return theme === 'system' ? getSystemTheme() : theme;
      },
    }),
    {
      name: 'theme-storage',
      onRehydrateStorage: () => (state) => {
        // Apply theme on rehydration
        if (state) {
          const effectiveTheme = state.getEffectiveTheme();
          document.documentElement.setAttribute('data-theme', effectiveTheme);
          document.documentElement.style.colorScheme = effectiveTheme;
        }
      },
    }
  )
);
