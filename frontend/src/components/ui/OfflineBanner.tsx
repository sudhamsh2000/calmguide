'use client';

import { useTranslations } from 'next-intl';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

/**
 * Persistent banner shown while the browser is known to be offline (P2-12
 * degraded-mode scaffolding). Renders nothing when online or while
 * connectivity is still being determined (isOnline === null) — see
 * useNetworkStatus's docstring for why unknown state is treated as online.
 *
 * This only surfaces the offline state; it does not queue or retry
 * requests. Screens using it should still show their own error copy
 * (distinguishing offline vs. server error) when a request actually fails.
 * Mirrors mobile/src/components/OfflineBanner.tsx.
 */
export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  const t = useTranslations('common');

  if (isOnline !== false) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="rounded-2xl border-s-4 border-s-foreground-muted bg-foreground-muted/10 px-4 py-3.5 flex flex-col gap-1"
    >
      <p className="text-sm font-bold text-foreground">{t('network.offline_banner')}</p>
      <p className="text-[13px] text-foreground-muted leading-snug">
        {t('network.offline_detail')}
      </p>
    </div>
  );
}
