/**
 * Enterprise Card Component
 * Consistent card design with proper spacing and elevation
 */

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cardHover, fadeIn } from '../../lib/utils/animations';

export interface CardProps {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
  onClick?: () => void;
  padding?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'elevated' | 'outlined';
  header?: ReactNode;
  footer?: ReactNode;
}

const paddingClasses = {
  sm: 'p-4 sm:p-6',
  md: 'p-6 sm:p-8',
  lg: 'p-8 sm:p-10'
};

const variantClasses = {
  default: 'card-enterprise',
  elevated: 'card-enterprise shadow-md',
  outlined: 'card-enterprise border-2'
};

export function Card({
  children,
  className = '',
  hoverable = false,
  onClick,
  padding = 'md',
  variant = 'default',
  header,
  footer
}: CardProps) {
  const baseClasses = `${variantClasses[variant]} ${onClick ? 'cursor-pointer' : ''} ${className}`;
  const Component = hoverable || onClick ? motion.div : 'div';

  const contentPadding = paddingClasses[padding];

  const props =
    hoverable || onClick
      ? {
          variants: fadeIn,
          initial: 'hidden',
          animate: 'visible',
          whileHover: hoverable ? cardHover.hover : undefined,
          whileTap: onClick ? cardHover.tap : undefined,
          onClick,
          className: baseClasses
        }
      : { className: baseClasses };

  return (
    <Component {...props}>
      {header && (
        <div className={`border-b border-[var(--brand-border)] ${contentPadding} pb-4`}>
          {header}
        </div>
      )}
      <div className={contentPadding}>{children}</div>
      {footer && (
        <div className={`border-t border-[var(--brand-border)] ${contentPadding} pt-4`}>
          {footer}
        </div>
      )}
    </Component>
  );
}
