'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card } from '@/components/ui/Card';
import type { PatternResponse } from '@/lib/api';

export interface IncidentPatternCardProps {
  patterns: PatternResponse;
  className?: string;
}

export function IncidentPatternCard({ patterns, className = '' }: IncidentPatternCardProps) {
  const t = useTranslations('incidents');

  const trends = patterns.frequency_trends as Record<
    string,
    { current_weekly?: number; previous_weekly?: number; direction?: string }
  >;
  const effective = patterns.effective_interventions as Array<{
    intervention?: string;
    count?: number;
  }>;

  const topTrend = Object.entries(trends).sort(
    (a, b) => (b[1].current_weekly ?? 0) - (a[1].current_weekly ?? 0),
  )[0];
  const topIntervention = effective[0];

  if (!topTrend) return null;

  const [category, data] = topTrend;

  return (
    <Card variant="default" padding="md" className={className}>
      <p className="text-sm font-semibold text-foreground mb-3">{t('patterns.title')}</p>

      <div className="flex flex-col gap-2">
        <p className="text-base text-foreground">
          <span className="capitalize">{category.replace(/_/g, ' ')}</span>
          {': '}
          <span className="font-semibold">
            {data.current_weekly ?? 0}x {t('patterns.this_week')}
          </span>
        </p>
        {data.direction === 'increasing' && data.previous_weekly !== undefined && (
          <p className="text-sm text-foreground-muted">
            {'↑ '}
            {t('patterns.up_from', { count: data.previous_weekly })}
          </p>
        )}
        {topIntervention?.intervention && (
          <p className="text-sm text-foreground-muted">
            {t('patterns.whats_helping')}: {topIntervention.intervention}
            {topIntervention.count ? ` (${topIntervention.count}x)` : ''}
          </p>
        )}
      </div>

      <Link
        href="/incidents"
        className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
      >
        {t('patterns.see_details')}
      </Link>
    </Card>
  );
}
