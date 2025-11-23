/**
 * Theme Toggle with Tooltip
 * Enhanced theme toggle with accessibility and tooltip support
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '../../lib/theme/useTheme';

export interface ThemeToggleWithTooltipProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggleWithTooltip({
  className = '',
  showLabel = false
}: ThemeToggleWithTooltipProps) {
  const { theme, effectiveTheme, setLightTheme, setDarkTheme, setSystemTheme } = useTheme();
  const [showTooltip, setShowTooltip] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const getThemeIcon = () => {
    if (theme === 'system') return <Monitor className="h-5 w-5" />;
    return effectiveTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />;
  };

  const getThemeLabel = () => {
    if (theme === 'system') return 'System';
    return effectiveTheme === 'dark' ? 'Light' : 'Dark';
  };

  const handleToggle = () => {
    if (effectiveTheme === 'dark') {
      setLightTheme();
    } else {
      setDarkTheme();
    }
  };

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => {
        if (!showMenu) setShowTooltip(false);
      }}
    >
      <motion.button
        type="button"
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setShowMenu(true);
          }
        }}
        aria-label={`Switch to ${getThemeLabel().toLowerCase()} theme`}
        aria-haspopup="menu"
        aria-expanded={showMenu}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-[var(--brand-surface-secondary)] text-[var(--brand-surface-contrast)] transition hover:bg-[var(--brand-surface-tertiary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]"
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.05 }}
      >
        <motion.span
          key={effectiveTheme}
          initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {getThemeIcon()}
        </motion.span>
      </motion.button>

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && !showMenu && (
          <motion.div
            className="absolute right-0 top-full z-50 mt-2 whitespace-nowrap rounded-md bg-[var(--brand-surface)] px-3 py-1.5 text-xs font-medium text-[var(--brand-surface-contrast)] shadow-lg border border-[var(--brand-border)]"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            role="tooltip"
          >
            {showLabel && <span className="mr-2 capitalize">{theme}</span>}
            Switch to {getThemeLabel().toLowerCase()} theme
            <span className="ml-2 text-[var(--brand-muted)]">(Click for menu)</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Theme Menu */}
      <AnimatePresence>
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
              aria-hidden="true"
            />
            <motion.div
              className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-xl backdrop-blur"
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 200, damping: 18 }}
              aria-label="Theme options"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setShowMenu(false);
                }
              }}
            >
              <div className="p-2">
                <button
                  type="button"
                  onClick={() => {
                    setLightTheme();
                    setShowMenu(false);
                  }}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                    theme === 'light'
                      ? 'bg-[var(--brand-primary-light)] text-[var(--brand-primary)]'
                      : 'text-[var(--brand-surface-contrast)] hover:bg-[var(--brand-surface-secondary)]'
                  } focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--brand-primary)]`}
                >
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    <span>Light</span>
                    {theme === 'light' && <span className="ml-auto text-xs">✓</span>}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDarkTheme();
                    setShowMenu(false);
                  }}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                    theme === 'dark'
                      ? 'bg-[var(--brand-primary-light)] text-[var(--brand-primary)]'
                      : 'text-[var(--brand-surface-contrast)] hover:bg-[var(--brand-surface-secondary)]'
                  } focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--brand-primary)]`}
                >
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    <span>Dark</span>
                    {theme === 'dark' && <span className="ml-auto text-xs">✓</span>}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSystemTheme();
                    setShowMenu(false);
                  }}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                    theme === 'system'
                      ? 'bg-[var(--brand-primary-light)] text-[var(--brand-primary)]'
                      : 'text-[var(--brand-surface-contrast)] hover:bg-[var(--brand-surface-secondary)]'
                  } focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--brand-primary)]`}
                >
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    <span>System</span>
                    {theme === 'system' && <span className="ml-auto text-xs">✓</span>}
                  </div>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ThemeToggleWithTooltip;
