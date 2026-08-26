'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ErrorState } from '@/components/ui/ErrorState';

export default function CoachError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('coach');

  useEffect(() => {
    console.error('Coach error boundary caught:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-8">
      <ErrorState message={t('error.loading_failed')} onRetry={reset} />
    </div>
  );
}
