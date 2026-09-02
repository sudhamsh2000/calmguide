'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { getDisclaimerAccepted, setDisclaimerAccepted } from '@/lib/storage';

export function MedicalDisclaimer({ children }: { children: React.ReactNode }) {
  const t = useTranslations('common.disclaimer');
  const [accepted, setAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    setAccepted(getDisclaimerAccepted());
  }, []);

  if (accepted === null) return null;

  if (accepted) return <>{children}</>;

  return (
    <main className="flex flex-col h-full items-center justify-center px-6">
      <div className="max-w-md w-full rounded-2xl border border-foreground/15 bg-background p-6 shadow-lg">
        <h2
          className="text-xl font-semibold text-foreground mb-4"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('title')}
        </h2>

        <div className="space-y-3 text-base text-foreground leading-relaxed mb-6">
          <p>
            {t('lead_a')} <strong>{t('lead_a_emph')}</strong>
            {t('lead_a_tail')} {t('lead_b')} <strong>{t('lead_b_emph')}</strong>
            {t('lead_b_tail')}
          </p>
          <p>{t('no_diagnosis')}</p>
          <ul className="list-disc ps-5 space-y-1">
            <li>
              {t('bullet_emergency')} <strong>911</strong>
            </li>
            <li>{t('bullet_doctor')}</li>
            <li>
              {t('bullet_helpline_lead')} <strong>{t('bullet_helpline_emph')}</strong>{' '}
              {t('bullet_helpline_at')}{' '}
              <a href="tel:18002723900" className="underline text-primary font-semibold">
                1-800-272-3900
              </a>
            </li>
          </ul>
          <p className="text-foreground-muted text-sm">{t('ack')}</p>
        </div>

        <button
          type="button"
          onClick={() => {
            setDisclaimerAccepted();
            setAccepted(true);
          }}
          className="w-full rounded-xl bg-primary px-6 py-3 min-h-[48px] text-base font-semibold text-white transition-colors hover:bg-primary-light dark:hover:bg-[#4ca9a4]"
        >
          {t('cta')}
        </button>
      </div>
    </main>
  );
}
