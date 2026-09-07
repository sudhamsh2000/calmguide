'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRequireRole } from '@/hooks/useRequireRole';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useFacility } from '@/context/FacilityContext';
import { getMyResidents } from '@/lib/facility-api';
import type { ResidentSummary, RiskLevel } from '@/lib/facility-api';

const RISK_ORDER: Record<string, number> = { high: 0, moderate: 1, low: 2 };

const RISK_BADGE: Record<string, string> = {
  high: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  moderate: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  low: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
};

const TREND_DISPLAY: Record<string, string> = {
  spike: '↑↑',
  increasing: '↑',
  stable: '→',
  decreasing: '↓',
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
    const cat = CATEGORY_LABELS[match[1]] ?? match[1].replace(/_/g, ' ');
    const outcome = match[2].replace(/_/g, ' ');
    return `${cat} (${outcome})`;
  }
  return raw.replace(/_/g, ' ');
}

export default function AllResidentsPage() {
  const { allowed } = useRequireRole('admin', 'owner');

  const t = useTranslations('facility.residents_all');
  const tRisk = useTranslations('facility.residents');
  const params = useParams();
  const router = useRouter();
  const locale = (params.locale as string) ?? 'en';
  const { state } = useFacility();

  const [residents, setResidents] = useState<ResidentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'risk' | 'room'>('risk');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyResidents();
      setResidents(data.residents);
    } catch {
      // handled silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (state.authenticated) load();
  }, [state.authenticated, load]);

  const filtered = residents.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.profile_id.toLowerCase().includes(s) ||
      (r.room?.toLowerCase().includes(s) ?? false) ||
      r.disease_stage.toLowerCase().includes(s)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'risk') {
      return (RISK_ORDER[a.risk_level] ?? 3) - (RISK_ORDER[b.risk_level] ?? 3);
    }
    return (a.room ?? '').localeCompare(b.room ?? '');
  });

  const counts = {
    total: residents.length,
    high: residents.filter((r) => r.risk_level === 'high').length,
    moderate: residents.filter((r) => r.risk_level === 'moderate').length,
    low: residents.filter((r) => r.risk_level === 'low').length,
  };

  if (!allowed) return null;

  return (
    <main className="flex flex-col h-full overflow-y-auto px-5 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <button
          type="button"
          onClick={() => router.push(`/${locale}/facility/residents/new`)}
          className="h-10 px-4 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors"
        >
          {t('add_resident')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('search')}
          className="field-shell h-10 flex-1 px-4 text-sm"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'risk' | 'room')}
          className="field-shell select-chevron select-chevron-sm h-10 px-3 text-sm"
        >
          <option value="risk">{t('sort_risk')}</option>
          <option value="room">{t('room')}</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-12 rounded-lg bg-foreground/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-foreground/[.06] bg-background/80 dark:border-white/[.12] dark:bg-white/[.02]">
            <table className="w-full text-start text-sm">
              <thead className="bg-foreground/[.02] dark:bg-white/[.015]">
                <tr>
                  <th className="px-4 py-3 font-medium text-foreground-muted">{t('room')}</th>
                  <th className="px-4 py-3 font-medium text-foreground-muted">{t('stage')}</th>
                  <th className="px-4 py-3 font-medium text-foreground-muted">{t('risk')}</th>
                  <th className="px-4 py-3 font-medium text-foreground-muted">{t('trend')}</th>
                  <th className="px-4 py-3 font-medium text-foreground-muted">{t('last')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/[.04] dark:divide-white/[.08]">
                {sorted.map((r) => (
                  <tr key={r.profile_id} className="hover:bg-foreground/[.02] transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/${locale}/facility/residents/${r.profile_id}${r.room ? `?room=${encodeURIComponent(r.room)}` : ''}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {r.room ?? r.profile_id.slice(0, 6)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-foreground capitalize">{r.disease_stage}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${RISK_BADGE[r.risk_level] ?? ''}`}
                      >
                        {tRisk(`risk_${r.risk_level}` as `risk_${RiskLevel}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {TREND_DISPLAY[r.trend_direction] ?? '→'}
                    </td>
                    <td className="px-4 py-3 text-foreground-muted text-xs">
                      {r.last_incident_summary
                        ? formatIncidentSummary(r.last_incident_summary)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-foreground-muted mt-3">{t('count_summary', counts)}</p>
        </>
      )}
    </main>
  );
}
