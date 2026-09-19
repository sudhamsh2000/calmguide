'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ResidentSummary } from '@/lib/facility-api';
import { formatResidentLocation } from '@/lib/facility-utils';

interface ResidentCardProps {
  resident: ResidentSummary;
  locale: string;
  className?: string;
}

const RISK_DOT: Record<string, string> = {
  high: 'bg-red-500',
  moderate: 'bg-orange-500',
  low: 'bg-green-500',
};

const CATEGORY_LABELS: Record<string, string> = {
  aggression_anger: 'Aggression',
  confusion_disorientation: 'Confusion',
  wandering_exit_seeking: 'Wandering',
  refusing_care: 'Refusing care',
  sleep_problems: 'Sleep issues',
  hallucinations: 'Hallucinations',
  repetitive_behavior: 'Repetitive behavior',
  other: 'Other',
};

function formatIncidentSummary(raw: string): string {
  const match = raw.match(/^(\w+)\s*\((\w+)\)$/);
  if (match) {
    const category = CATEGORY_LABELS[match[1]] ?? match[1].replace(/_/g, ' ');
    const outcome = match[2].replace(/_/g, ' ');
    return `${category} (${outcome})`;
  }
  return raw.replace(/_/g, ' ');
}

export function ResidentCard({ resident, locale, className = '' }: ResidentCardProps) {
  const t = useTranslations('facility.residents');
  const dot = RISK_DOT[resident.risk_level] ?? RISK_DOT.low;
  const riskLabel = t(`risk_${resident.risk_level}` as 'risk_high' | 'risk_moderate' | 'risk_low');

  return (
    <Link
      href={`/${locale}/facility/residents/${resident.profile_id}?${new URLSearchParams(
        Object.entries({
          unit: resident.unit,
          room: resident.room,
          bed: resident.bed,
          risk: resident.risk_level,
        }).filter(([, v]) => v != null) as [string, string][],
      ).toString()}`}
      className={`block card-shell rounded-full px-4 py-3 hover:border-primary/30 hover:shadow-sm active:bg-foreground/[.02] transition-all ${className}`}
    >
      {/* Header: room + risk dot */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-base font-bold text-foreground whitespace-nowrap">
          {formatResidentLocation(resident.unit, resident.room, resident.bed)}
        </span>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground-muted shrink-0">
          <span className={`size-2 rounded-full ${dot}`} />
          {riskLabel}
        </span>
      </div>

      {/* Top effective strategy — plain text */}
      {resident.top_effective && (
        <p className="text-sm text-foreground leading-snug mb-2 line-clamp-2">
          {resident.top_effective}
        </p>
      )}

      {/* Last incident summary */}
      {resident.last_incident_summary && (
        <p className="text-xs text-foreground-muted">
          Last: {formatIncidentSummary(resident.last_incident_summary)}
        </p>
      )}
    </Link>
  );
}
