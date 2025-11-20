import React from 'react';
import { motion } from 'framer-motion';
import { useBrand } from '../../ui/BrandProvider';
import { ThemeToggle } from '../../ui/ThemeToggle';

export interface AuthFormLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

const cardMotion = {
  initial: { opacity: 0, scale: 0.95, y: 20 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 10 },
  transition: { type: 'spring', stiffness: 300, damping: 30 }
};

export function AuthFormLayout({
  title,
  subtitle,
  children,
  footer,
  className = ''
}: AuthFormLayoutProps) {
  useBrand(); // Ensure theme context is available

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--brand-surface)] px-4 py-8 transition-colors duration-300 sm:px-6 sm:py-12 lg:px-8">
      {/* Theme Toggle - Top Right */}
      <div className="fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <motion.div
          variants={cardMotion}
          initial="initial"
          animate="animate"
          exit="exit"
          className={`relative overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-2xl transition-colors duration-300 ${className}`}
        >
          {/* Card Header */}
          <div className="border-b border-[var(--brand-border)] bg-gradient-to-r from-[var(--brand-primary)]/10 to-[var(--brand-accent)]/10 px-4 py-6 sm:px-6 sm:py-8">
            <h1 className="text-center text-xl font-bold text-[var(--brand-surface-contrast)] sm:text-2xl lg:text-3xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-center text-xs text-[var(--brand-muted)] sm:text-sm lg:text-base">
                {subtitle}
              </p>
            )}
          </div>

          {/* Card Body */}
          <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">{children}</div>

          {/* Card Footer */}
          {footer && (
            <div className="border-t border-[var(--brand-border)] bg-[var(--brand-surface)]/50 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
              {footer}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default AuthFormLayout;
