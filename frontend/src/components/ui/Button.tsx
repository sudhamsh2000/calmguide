'use client';

import { type ButtonHTMLAttributes, forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  className?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-light active:bg-primary-dark disabled:bg-primary/45 disabled:text-white',
  secondary: 'outline-button disabled:text-primary/55',
  danger: 'bg-error text-white hover:bg-error/90 active:bg-error/80 disabled:bg-error/45',
  ghost:
    'text-foreground hover:bg-foreground/5 active:bg-foreground/10 disabled:text-foreground-muted',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm rounded-lg',
  md: 'h-10 px-4 text-base rounded-xl',
  lg: 'h-12 min-w-tap px-6 text-lg rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled,
    className = '',
    children,
    ...props
  },
  ref,
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center whitespace-nowrap font-semibold transition-colors focus-ring',
        variantStyles[variant],
        sizeStyles[size],
        isDisabled ? 'cursor-not-allowed shadow-none' : 'cursor-pointer',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {loading ? (
        <>
          <svg
            className="me-2 h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
});
