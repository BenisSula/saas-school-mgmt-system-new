import React from 'react';
import { motion } from 'framer-motion';
import { buttonPress } from '../../lib/utils/animations';
import { cn } from '../../lib/utils/cn';

export type ButtonVariant = 'solid' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration'
  > {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-3 text-base'
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'solid',
      size = 'md',
      leftIcon,
      rightIcon,
      loading = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    const baseClasses =
      'inline-flex items-center justify-center gap-2 rounded-md font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors duration-150 disabled:cursor-not-allowed';

    const variantClasses: Record<ButtonVariant, string> = {
      solid:
        'border border-transparent text-[var(--brand-primary-contrast)] bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] focus-visible:outline-[var(--brand-primary)] disabled:opacity-60 transition-colors duration-200',
      outline:
        'border border-[var(--brand-primary)] text-[var(--brand-primary)] bg-transparent hover:bg-[var(--brand-primary-light)] focus-visible:outline-[var(--brand-primary)] disabled:opacity-50 transition-colors duration-200',
      ghost:
        'border border-transparent text-[var(--brand-primary)] bg-transparent hover:bg-[var(--brand-surface-secondary)] focus-visible:outline-[var(--brand-primary)] disabled:opacity-50 transition-colors duration-200'
    };

    // Animation-related props are already excluded from ButtonProps via Omit
    // No need to destructure them as they don't exist in props
    // Cast restProps to avoid type conflicts with framer-motion
    const motionProps = {
      ...props,
      ref,
      'data-variant': variant,
      'data-size': size,
      className: cn(
        baseClasses,
        SIZE_CLASSES[size],
        variantClasses[variant],
        'touch-target',
        className
      ),
      disabled: isDisabled,
      'aria-disabled': isDisabled,
      whileHover: !isDisabled ? buttonPress.hover : undefined,
      whileTap: !isDisabled ? buttonPress.tap : undefined,
      transition: { duration: 0.15 }
    } as React.ComponentPropsWithoutRef<typeof motion.button>;

    return (
      <motion.button {...motionProps}>
        {loading && (
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border border-current border-t-transparent"
            aria-hidden="true"
          />
        )}
        {leftIcon ? <span aria-hidden="true">{leftIcon}</span> : null}
        <span>{children}</span>
        {rightIcon ? <span aria-hidden="true">{rightIcon}</span> : null}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
