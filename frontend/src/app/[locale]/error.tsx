'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Root error boundary caught:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-8">
      <ErrorState
        message="Something unexpected happened. Please try again."
        onRetry={reset}
      />
    </div>
  );
}
