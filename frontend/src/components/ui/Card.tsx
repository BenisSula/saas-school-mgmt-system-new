/**
 * Shared Card component
 * Consolidates duplicate card patterns across the codebase
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
}

const paddingClasses = {
  sm: 'p-3 sm:p-4',
  md: 'p-4 sm:p-6',
  lg: 'p-6 sm:p-8'
};

export function Card({
  children,
  className = '',
  hoverable = false,
  onClick,
  padding = 'md'
}: CardProps) {
  const baseClasses = `card-base ${paddingClasses[padding]} ${onClick ? 'cursor-pointer' : ''} ${className}`;

  if (hoverable || onClick) {
    return (
      <motion.div
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        whileHover={hoverable ? cardHover.hover : undefined}
        whileTap={onClick ? cardHover.tap : undefined}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={onClick}
        className={baseClasses}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      className={baseClasses}
    >
      {children}
    </motion.div>
  );
}
