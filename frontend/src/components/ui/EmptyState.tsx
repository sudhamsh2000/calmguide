'use client';

import type { ReactNode } from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: ReactNode;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

function DefaultEmptyIcon() {
  return (
    <svg
      className="h-16 w-16 text-foreground-muted/40"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Gentle empty state — open circle with a soft line */}
      <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" />
      <path
        d="M24 32h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

export function EmptyState({
  icon,
  message,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center text-center px-6 py-10 ${className}`}
    >
      <div className="mb-4">
        {icon ?? <DefaultEmptyIcon />}
      </div>

      <p className="text-base text-foreground-muted leading-relaxed max-w-xs">
        {message}
      </p>

      {actionLabel && onAction && (
        <Button
          variant="secondary"
          size="md"
          onClick={onAction}
          className="mt-5"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
