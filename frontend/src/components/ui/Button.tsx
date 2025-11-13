import React from 'react';

export type ButtonVariant = 'solid' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
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
        'border border-transparent text-[var(--brand-primary-contrast)] bg-[var(--brand-primary)] hover:brightness-110 focus-visible:outline-[var(--brand-primary)] disabled:opacity-60',
      outline:
        'border border-[var(--brand-primary)] text-[var(--brand-primary)] bg-transparent hover:bg-[rgba(29,78,216,0.08)] focus-visible:outline-[var(--brand-primary)] disabled:opacity-50',
      ghost:
        'border border-transparent text-[var(--brand-primary)] bg-transparent hover:bg-[rgba(29,78,216,0.08)] focus-visible:outline-[var(--brand-primary)] disabled:opacity-50'
    };

    return (
      <button
        ref={ref}
        data-variant={variant}
        data-size={size}
        className={`${baseClasses} ${SIZE_CLASSES[size]} ${variantClasses[variant]} ${className}`}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        {...props}
      >
        {loading && (
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border border-current border-t-transparent"
            aria-hidden="true"
          />
        )}
        {leftIcon ? <span aria-hidden="true">{leftIcon}</span> : null}
        <span>{children}</span>
        {rightIcon ? <span aria-hidden="true">{rightIcon}</span> : null}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
