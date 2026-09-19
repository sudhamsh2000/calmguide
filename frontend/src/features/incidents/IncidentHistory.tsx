'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card } from '@/components/ui/Card';
import { getAccessCode } from '@/lib/storage';
import { getIncidents } from '@/lib/api';
import type { BehaviorCategory, IncidentResponse, SeverityLevel } from '@/lib/api';

export interface IncidentHistoryProps {
  className?: string;
}

const CATEGORY_SHORT: Record<BehaviorCategory, string> = {
  aggression_anger: 'A',
  confusion_disorientation: 'C',
  wandering_exit_seeking: 'W',
  refusing_care: 'R',
  sleep_problems: 'S',
  hallucinations: 'H',
  repetitive_behavior: 'P',
  other: 'O',
};

const CATEGORY_COLORS: Record<BehaviorCategory, string> = {
  aggression_anger: '#DC4E4E',
  confusion_disorientation: '#D4893A',
  wandering_exit_seeking: '#3A7D5C',
  refusing_care: '#8B5E3C',
  sleep_problems: '#5B6ABF',
  hallucinations: '#7B5EA7',
  repetitive_behavior: '#4A90A4',
  other: '#6B7280',
};

const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  mild: 'bg-success-bg text-success-text',
  moderate: 'bg-warning-bg text-warning-text',
  severe: 'bg-error-bg text-error',
};

function formatIncidentDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function IncidentHistory({ className = '' }: IncidentHistoryProps) {
  const t = useTranslations('incidents');
  const [incidents, setIncidents] = useState<IncidentResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<BehaviorCategory | ''>('');

  const loadIncidents = useCallback(async () => {
    const code = getAccessCode();
    if (!code) return;
    setLoading(true);
    try {
      const result = await getIncidents(code, {
        category: categoryFilter || undefined,
        limit: 50,
      });
      setIncidents(result.incidents);
      setTotal(result.total);
    } catch {
      /* silent */
    }
    setLoading(false);
  }, [categoryFilter]);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setCategoryFilter('')}
          className={`shrink-0 rounded-full px-4 py-2 min-h-[40px] text-sm font-medium border transition-all cursor-pointer ${
            !categoryFilter
              ? 'border-primary/60 bg-primary/[0.07] text-primary dark:border-primary/45 dark:bg-primary/[0.11] dark:text-primary-light shadow-[inset_0_0_0_1px_rgba(58,175,169,0.22)]'
              : 'border-border dark:border-theme-soft bg-surface text-foreground hover:border-primary/20 hover:bg-primary/[0.025] dark:hover:border-primary/25 dark:hover:bg-primary/[0.05]'
          }`}
        >
          {t('history.filter_all_types')}
        </button>
        {(Object.keys(CATEGORY_SHORT) as BehaviorCategory[]).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`shrink-0 rounded-full px-4 py-2 min-h-[40px] text-sm font-medium border transition-all cursor-pointer ${
              categoryFilter === cat
                ? 'border-primary/60 bg-primary/[0.07] text-primary dark:border-primary/45 dark:bg-primary/[0.11] dark:text-primary-light shadow-[inset_0_0_0_1px_rgba(58,175,169,0.22)]'
                : 'border-border dark:border-theme-soft bg-surface text-foreground hover:border-primary/20 hover:bg-primary/[0.025] dark:hover:border-primary/25 dark:hover:bg-primary/[0.05]'
            }`}
          >
            {t(`logger.category.${cat}`).replace(/\n/g, ' ')}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
        </div>
      )}

      {!loading && incidents.length === 0 && (
        <div className="text-center py-12">
          <p className="text-lg text-foreground-muted">{t('history.no_incidents')}</p>
          <p className="text-sm text-foreground-muted mt-1">{t('history.no_incidents_subtitle')}</p>
        </div>
      )}

      {incidents.map((incident) => (
        <Link key={incident.id} href={`/incidents/${incident.id}`} className="block">
          <Card variant="interactive" padding="md">
            <div className="flex items-start gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{
                  backgroundColor:
                    CATEGORY_COLORS[incident.behavior_category as BehaviorCategory] ?? '#6B7280',
                }}
                aria-hidden="true"
              >
                {CATEGORY_SHORT[incident.behavior_category as BehaviorCategory] ?? '?'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground-muted">
                    {formatIncidentDate(incident.incident_time)}
                  </span>
                  {incident.severity && (
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${SEVERITY_COLORS[incident.severity]}`}
                    >
                      {t(`logger.severity.${incident.severity}`)}
                    </span>
                  )}
                </div>
                <p className="text-base text-foreground mt-1 line-clamp-2">
                  {incident.behavior_description}
                </p>
                {incident.intervention_outcome && (
                  <p className="text-sm text-foreground-muted mt-1">
                    {t(`history.${incident.intervention_outcome}`)}
                    {incident.intervention_description
                      ? ` (${incident.intervention_description})`
                      : ''}
                  </p>
                )}
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
