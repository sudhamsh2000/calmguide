'use client';

import { useTranslations } from 'next-intl';

export interface BreathingIndicatorProps {
  /** Optional override; defaults to the localized "finding guidance" copy. */
  message?: string;
  className?: string;
}

export function BreathingIndicator({ message, className = '' }: BreathingIndicatorProps) {
  const t = useTranslations('coach');
  const resolvedMessage = message ?? t('finding_guidance');
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center gap-4 ${className}`}
    >
      <div className="animate-breathing h-16 w-16 rounded-full bg-primary/30" aria-hidden="true" />
      <p className="text-base text-foreground-muted font-sans">{resolvedMessage}</p>
    </div>
  );
}
