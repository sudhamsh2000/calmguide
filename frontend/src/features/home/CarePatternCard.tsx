'use client';

import { useTranslations } from 'next-intl';
import type { CarePatternData } from '@/lib/api';

interface CarePatternCardProps {
  carePattern: CarePatternData;
}

export function CarePatternCard({ carePattern }: CarePatternCardProps) {
  const t = useTranslations('home.care_patterns');
  const tc = useTranslations('common.tags');

  const tagLabel = (key: string) => tc.has(key) ? tc(key) : key;

  const reasonText = carePattern.reason.type === 'cycle' && carePattern.reason.avg_interval_days
    ? t('reason_cycle', {
        interval: Math.round(carePattern.reason.avg_interval_days),
        days_since: carePattern.reason.days_since_last ?? 0,
      })
    : t('reason_trend');

  return (
    <div className="rounded-2xl border border-foreground/10 border-s-4 border-s-amber-500 bg-surface p-4 space-y-2.5">
      <h3 className="text-sm font-semibold text-foreground">
        {t('title')}
      </h3>
      <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
        {reasonText}
      </p>

      {carePattern.top_strategies.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-amber-600 dark:text-amber-400">{t('what_helps')}</p>
          <div className="flex flex-wrap gap-1.5">
            {carePattern.top_strategies.map(tag => (
              <span
                key={tag}
                className="rounded-full bg-amber-100 dark:bg-amber-900/50 px-2.5 py-0.5 text-xs text-amber-800 dark:text-amber-200"
              >
                {tagLabel(tag)}
              </span>
            ))}
          </div>
        </div>
      )}

      {carePattern.cross_patient && (
        <p className="text-[11px] text-amber-600/70 dark:text-amber-400/60 italic">
          {t('cross_patient_hint', {
            count: carePattern.cross_patient.cohort_size,
            strategy: tagLabel(carePattern.cross_patient.top_strategy),
          })}
        </p>
      )}
    </div>
  );
}
