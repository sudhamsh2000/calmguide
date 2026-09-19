'use client';

import { type ButtonHTMLAttributes } from 'react';

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  label: string;
  selected: boolean;
  onToggle: () => void;
  className?: string;
}

export function Chip({ label, selected, onToggle, className = '', ...props }: ChipProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onToggle}
      className={[
        'inline-flex items-center justify-center min-h-tap px-4 py-2 rounded-full text-base font-medium transition-all border-2 cursor-pointer',
        'focus-ring',
        selected
          ? 'border-primary bg-primary text-onPrimary shadow-none dark:border-primary/70 dark:bg-primary/85 dark:text-onPrimary dark:shadow-none'
          : 'bg-surface text-foreground border-foreground/15 shadow-none hover:border-primary/35 hover:bg-primary/[0.045] hover:text-primary hover:shadow-[0_1px_2px_rgba(23,37,42,0.06)] dark:border-white/[0.07] dark:bg-surface dark:shadow-none dark:hover:border-primary/30 dark:hover:bg-primary/[0.08] dark:hover:text-primary-light dark:hover:shadow-[0_0_0_1px_rgba(62,143,208,0.12)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {label}
    </button>
  );
}
