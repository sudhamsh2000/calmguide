'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';

export default function LearnError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Learn error boundary caught:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-8">
      <ErrorState
        message="We could not load the learning scenarios. Please try again."
        onRetry={reset}
      />
    </div>
  );
}
