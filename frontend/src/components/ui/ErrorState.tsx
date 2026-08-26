'use client';

import { useTranslations } from 'next-intl';
import { Button } from './Button';

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ message, onRetry, className = '' }: ErrorStateProps) {
  const tc = useTranslations('common');
  return (
    <div
      role="alert"
      className={`flex flex-col items-center text-center rounded-2xl bg-error/8 dark:bg-error/15 px-6 py-8 ${className}`}
    >
      {/* Gentle warning icon */}
      <svg
        className="h-12 w-12 text-error mb-4"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2.5" opacity="0.3" />
        <circle cx="24" cy="33" r="2" fill="currentColor" />
        <path
          d="M24 16v12"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>

      <p className="text-base font-medium text-foreground leading-relaxed max-w-xs">
        {message}
      </p>

      {onRetry && (
        <Button
          variant="secondary"
          size="md"
          onClick={onRetry}
          className="mt-5"
        >
          {tc('actions.try_again')}
        </Button>
      )}
    </div>
  );
}
