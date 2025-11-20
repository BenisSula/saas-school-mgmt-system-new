/**
 * Mobile menu button component
 * Optimized for touch interactions
 */
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';

export interface MobileMenuButtonProps {
  isOpen: boolean;
  onClick: () => void;
  'aria-label'?: string;
  className?: string;
}

export function MobileMenuButton({
  isOpen,
  onClick,
  'aria-label': ariaLabel = 'Toggle navigation',
  className = ''
}: MobileMenuButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={isOpen}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--brand-border)] bg-[var(--brand-surface-secondary)] text-[var(--brand-text-primary)] transition-all duration-200 hover:bg-[var(--brand-surface-tertiary)] hover:border-[var(--brand-border-strong)] focus-visible-ring touch-target ${className}`}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        initial={false}
        animate={{ rotate: isOpen ? 90 : 0 }}
        transition={{ duration: 0.2 }}
      >
        {isOpen ? (
          <X className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Menu className="h-5 w-5" aria-hidden="true" />
        )}
      </motion.div>
    </motion.button>
  );
}

export default MobileMenuButton;

