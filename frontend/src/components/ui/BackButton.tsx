'use client';

import { Link } from '@/i18n/navigation';

export interface BackButtonProps {
  href: string;
  label?: string;
  className?: string;
}

export function BackButton({ href, label = 'Go back', className = '' }: BackButtonProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={[
        'flex h-11 w-11 items-center justify-center rounded-xl',
        'border border-slate-300/85 bg-surface/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(23,37,42,0.05)]',
        'text-foreground-muted transition-all hover:border-slate-400 hover:bg-surface hover:text-foreground hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_1px_3px_rgba(23,37,42,0.08)]',
        'dark:border-[#31445f] dark:bg-surface/55 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_0_0_1px_rgba(26,35,50,0.12)]',
        'dark:hover:border-[#3a4f6d] dark:hover:bg-surface dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(36,52,71,0.18)]',
        'focus-ring',
        className,
      ].filter(Boolean).join(' ')}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="rtl:scale-x-[-1]"
      >
        <path d="M19 12H5" />
        <path d="M12 19l-7-7 7-7" />
      </svg>
    </Link>
  );
}
