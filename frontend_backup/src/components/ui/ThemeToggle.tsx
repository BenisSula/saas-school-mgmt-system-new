import React from 'react';
import { motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useBrand } from './BrandProvider';

const ThemeToggleComponent = function ThemeToggle() {
  const { theme, toggleTheme } = useBrand();
  const isDark = theme === 'dark';

  return (
    <motion.button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      className="interactive-button relative flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-[color:var(--brand-surface-contrast)]/10 text-[var(--brand-surface-contrast)] transition hover:border-[var(--brand-border)] hover:bg-[var(--brand-surface-contrast)]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]"
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.05 }}
    >
      <motion.span
        key={theme}
        initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="absolute inset-0 flex items-center justify-center"
      >
        {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </motion.span>
    </motion.button>
  );
};

export const ThemeToggle = React.memo(ThemeToggleComponent);
ThemeToggle.displayName = 'ThemeToggle';

export default ThemeToggle;
