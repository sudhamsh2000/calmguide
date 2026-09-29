'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { verifyIncident } from '@/lib/api';
import type { IncidentUpdate, VerificationPending } from '@/lib/api';

export interface VerificationCardProps {
  accessCode: string;
  pending: VerificationPending;
  onDismiss: () => void;
  className?: string;
}

export function VerificationCard({
  accessCode,
  pending,
  onDismiss,
  className = '',
}: VerificationCardProps) {
  const t = useTranslations('incidents');
  const [fading, setFading] = useState(false);

  const handleApprove = useCallback(async () => {
    try {
      await verifyIncident(accessCode, pending.incident_id, { approved: true });
    } catch {
      /* silent */
    }
    setFading(true);
    setTimeout(onDismiss, 400);
  }, [accessCode, pending.incident_id, onDismiss]);

  const handleFix = useCallback(async () => {
    // For now, approve with no corrections — full field-by-field editing deferred
    try {
      await verifyIncident(accessCode, pending.incident_id, {
        approved: true,
        corrections: null,
      });
    } catch {
      /* silent */
    }
    setFading(true);
    setTimeout(onDismiss, 400);
  }, [accessCode, pending.incident_id, onDismiss]);

  const handleDismiss = useCallback(() => {
    setFading(true);
    setTimeout(onDismiss, 400);
  }, [onDismiss]);

  return (
    <div
      className={`transition-all duration-400 ease-out ${
        fading ? 'opacity-0 -translate-y-2 max-h-0 overflow-hidden' : 'opacity-100 translate-y-0'
      } ${className}`}
    >
      <Card variant="default" padding="md">
        <p className="text-sm font-semibold text-foreground mb-3">{t('verification.title')}</p>
        <p className="text-base text-foreground leading-relaxed mb-4">{pending.summary_text}</p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="primary"
            size="md"
            className="flex-auto"
            onClick={handleApprove}
            aria-label={t('verification.looks_right')}
          >
            {t('verification.looks_right')}
          </Button>
          <Button
            variant="secondary"
            size="md"
            className="flex-auto"
            onClick={handleFix}
            aria-label={t('verification.let_me_fix')}
          >
            {t('verification.let_me_fix')}
          </Button>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="mt-3 w-full text-center text-sm text-foreground-muted hover:text-foreground transition-colors min-h-[44px] flex items-center justify-center cursor-pointer"
        >
          {t('verification.dismiss')}
        </button>
      </Card>
    </div>
  );
}
