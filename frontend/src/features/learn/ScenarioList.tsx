'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { getScenarios } from '@/lib/api';
import type { Scenario } from '@/lib/api';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { Chip } from '@/components/ui/Chip';
import { BackButton } from '@/components/ui/BackButton';

export interface ScenarioListProps {
  className?: string;
}

const CATEGORY_FILTER_KEYS = [
  { value: 'all', key: 'list.filter_all' },
  { value: 'behavioral', key: 'list.filter_behavioral' },
  { value: 'daily_care', key: 'list.filter_daily_care' },
  { value: 'safety', key: 'list.filter_safety' },
  { value: 'communication', key: 'list.filter_communication' },
  { value: 'self_care', key: 'list.filter_self_care' },
] as const;

export function ScenarioList({ className = '' }: ScenarioListProps) {
  const router = useRouter();
  const t = useTranslations('learn');
  const tc = useTranslations('common');
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getScenarios()
      .then((data) => {
        if (!cancelled) {
          setScenarios(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(t('list.load_error'));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredScenarios =
    selectedCategory === 'all'
      ? scenarios
      : scenarios.filter((s) => s.category === selectedCategory);

  return (
    <div className={`flex flex-col gap-5 px-5 pt-5 pb-8 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <BackButton href="/home" label={tc('nav.back_to_home')} />
        <div>
          <h1 className="text-xl font-medium text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
            {t('title')}
          </h1>
          <p className="text-sm text-foreground-muted mt-0.5">
            {t('list.subtitle')}
          </p>
        </div>
      </div>

      {/* Category Filter Chips */}
      <div
        className="flex flex-wrap gap-2"
        role="radiogroup"
        aria-label={t('list.filter_label')}
      >
        {CATEGORY_FILTER_KEYS.map((filter) => (
          <Chip
            key={filter.value}
            label={t(filter.key)}
            selected={selectedCategory === filter.value}
            onToggle={() => setSelectedCategory(filter.value)}
          />
        ))}
      </div>
      <div className="sr-only" aria-live="polite">
        {t('list.filter_label')}: {t(CATEGORY_FILTER_KEYS.find((f) => f.value === selectedCategory)?.key ?? 'list.filter_all')}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-foreground-muted">{t('list.loading')}</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div
          className="rounded-xl bg-error/10 border border-error/30 p-4"
          role="alert"
        >
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {/* Scenario Cards — single column on phones; two up from `sm` so
        * desktop uses the horizontal space the wider shell now provides
        * instead of running one long ribbon of cards. */}
      {!loading && !error && filteredScenarios.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filteredScenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              data-testid="scenario-card"
              onClick={() => router.push(`/learn/${scenario.id}`)}
              className="card-shell flex h-full flex-col items-start gap-2 p-5 text-start transition-all hover:border-primary/40 hover:shadow-md cursor-pointer focus-ring"
            >
              <div className="flex items-center gap-2">
                <CategoryBadge category={scenario.category} />
                <span className="inline-flex items-center rounded-full bg-foreground/5 px-2.5 py-0.5 text-xs font-medium text-foreground-muted capitalize">
                  {t('scenario.stage_label', { stage: t(`scenario.stages.${scenario.disease_stage}`) })}
                </span>
              </div>
              <h3
                className="text-lg font-semibold text-foreground leading-snug"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {t.has(`scenarios.${scenario.id}.title`) ? t(`scenarios.${scenario.id}.title`) : scenario.title}
              </h3>
              <p className="text-sm text-foreground-muted line-clamp-2 leading-relaxed">
                {t.has(`scenarios.${scenario.id}.description`) ? t(`scenarios.${scenario.id}.description`) : scenario.description}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredScenarios.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <p className="text-foreground-muted">
            {t('list.empty')}
          </p>
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className="text-primary font-medium hover:underline"
          >
            {t('list.show_all')}
          </button>
        </div>
      )}
    </div>
  );
}
