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

// `disabled:bg-primary/45` and friends compiled to fully transparent under
// Tailwind 3.4 — an opacity modifier on a bare `var(...)` colour can't be
// computed (see design/design.md changelog). `disabled:opacity-*` fades the
// whole element instead and works on any fill.
const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-onPrimary hover:bg-primary-light active:bg-primary-dark disabled:opacity-45',
  secondary: 'outline-button disabled:opacity-55',
  danger: 'bg-error text-white hover:bg-error/90 active:bg-error/80 disabled:opacity-45',
  ghost: 'text-foreground ghost-button disabled:text-foreground-muted',
};

// Pill, at every size — the palette's action shape, set on the landing
// page's CTAs and carried through the app so a button reads as a button
// before you read its label.
const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-4 text-sm rounded-full',
  md: 'h-10 px-5 text-base rounded-full',
  lg: 'h-12 min-w-tap px-7 text-lg rounded-full',
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
