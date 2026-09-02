'use client';

import { useTranslations } from 'next-intl';
import type { InsightsPayload } from '@/lib/api';

interface PatternInsightsProps {
  insights: InsightsPayload;
}

export function PatternInsights({ insights }: PatternInsightsProps) {
  const t = useTranslations('home.patterns');
  const tc = useTranslations('common.tags');

  const tagLabel = (key: string) => (tc.has(key) ? tc(key) : key);

  const TREND_CONFIG: Record<string, { icon: string; color: string; labelKey: string }> = {
    increasing: {
      icon: '\u2191',
      color: 'text-amber-600 dark:text-amber-400',
      labelKey: 'trend_rising',
    },
    decreasing: {
      icon: '\u2193',
      color: 'text-green-600 dark:text-green-400',
      labelKey: 'trend_falling',
    },
    stable: { icon: '\u2192', color: 'text-foreground-muted', labelKey: 'trend_steady' },
  };

  const trend = TREND_CONFIG[insights.crisis_frequency.trend] ?? TREND_CONFIG.stable;

  return (
    <section
      aria-label={t('title')}
      className="rounded-2xl border border-foreground/10 bg-surface p-4 space-y-3"
    >
      <h2 className="text-sm font-semibold text-foreground">{t('title')}</h2>

      {insights.drift_alert && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300/40 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/50 dark:text-amber-200"
        >
          {t('drift_alert', {
            last_count: insights.drift_alert.last_count,
            this_count: insights.drift_alert.this_count,
          })}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-background px-3 py-2.5">
          <p className="text-[11px] text-foreground-muted">{t('this_week')}</p>
          <p className="mt-0.5 text-xl font-bold text-foreground">
            {insights.crisis_frequency.this_week}
          </p>
          <p className={`text-[11px] font-medium ${trend.color}`}>
            {trend.icon} {t(trend.labelKey)}
          </p>
        </div>

        <div className="rounded-xl bg-background px-3 py-2.5">
          <p className="text-[11px] text-foreground-muted">{t('last_week')}</p>
          <p className="mt-0.5 text-xl font-bold text-foreground">
            {insights.crisis_frequency.last_week}
          </p>
        </div>

        <div className="rounded-xl bg-background px-3 py-2.5">
          <p className="text-[11px] text-foreground-muted">{t('peak_time')}</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            {t(`peak_${insights.peak_time}`)}
          </p>
        </div>
      </div>

      {insights.top_triggers.length > 0 && (
        <div>
          <p className="text-[11px] text-foreground-muted mb-1.5">{t('recurring_themes')}</p>
          <div className="flex flex-wrap gap-1.5">
            {insights.top_triggers.map((trigger) => (
              <span
                key={trigger}
                className="rounded-full border border-foreground/10 bg-background px-2.5 py-0.5 text-xs text-foreground-muted"
              >
                {trigger}
              </span>
            ))}
          </div>
        </div>
      )}

      {Object.keys(insights.effective_strategies ?? {}).length > 0 && (
        <div>
          <p className="text-[11px] text-foreground-muted mb-1.5">{t('effective_strategies')}</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(insights.effective_strategies)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(([strategy, count]) => (
                <span
                  key={strategy}
                  className="rounded-full border border-green-500/20 bg-green-50 dark:bg-green-950/30 px-2.5 py-0.5 text-xs text-green-700 dark:text-green-400"
                >
                  {tagLabel(strategy)} ({count})
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Episode cycle */}
      {insights.episode_cycle?.detected && (
        <div className="rounded-xl bg-background px-3 py-2.5">
          <p className="text-[11px] text-foreground-muted">{t('cycle_detected')}</p>
          <p className="text-sm font-semibold text-foreground">
            {t('cycle_interval', {
              days: Math.round(insights.episode_cycle.avg_interval_days ?? 0),
            })}
          </p>
        </div>
      )}

      {/* Cross-patient boost */}
      {insights.cross_patient_boost && insights.cross_patient_boost.strategies.length > 0 && (
        <div>
          <p className="text-[11px] text-foreground-muted mb-1.5">{t('cross_patient_title')}</p>
          <div className="flex flex-wrap gap-1.5">
            {insights.cross_patient_boost.strategies.slice(0, 3).map((s) => (
              <span
                key={s.tag}
                className="rounded-full border border-blue-500/20 bg-blue-50 dark:bg-blue-950/30 px-2.5 py-0.5 text-xs text-blue-700 dark:text-blue-400"
              >
                {tagLabel(s.tag)} ({s.helped}/{insights.cross_patient_boost!.cohort_size})
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
