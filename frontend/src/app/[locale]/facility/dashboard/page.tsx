'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRequireRole } from '@/hooks/useRequireRole';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { KpiCard } from '@/components/facility/KpiCard';
import { useFacility } from '@/context/FacilityContext';
import { downloadReport, getDashboardSummary, FacilityApiError } from '@/lib/facility-api';
import type { DashboardSummary } from '@/lib/facility-api';

export default function DashboardPage() {
  const { allowed } = useRequireRole('admin', 'owner');

  const t = useTranslations('facility.dashboard');
  const { state } = useFacility();

  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summary = await getDashboardSummary(24);
      setData(summary);
    } catch (err) {
      if (err instanceof FacilityApiError && err.status === 401) {
        setError("You've been signed out for safety.");
      } else {
        setError('Dashboard unavailable right now. Try refreshing in a moment.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (state.authenticated) load();
  }, [state.authenticated, load]);

  useEffect(() => {
    if (!state.authenticated) return;
    const interval = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [state.authenticated, load]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      await downloadReport(1);
    } catch {
      setError('Could not export the report right now. Try again in a moment.');
    } finally {
      setExporting(false);
    }
  }, []);

  if (!allowed) return null;

  return (
    <main className="flex flex-col h-full overflow-y-auto px-5 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
          {state.facilityName && (
            <p className="text-sm text-foreground-muted">{state.facilityName}</p>
          )}
        </div>
        {state.staff && (
          <Link href="/facility/profile" className="text-sm text-accentSky hover:underline">
            {state.staff.name.split(' ')[0]} ↗
          </Link>
        )}
      </div>

      <p className="text-sm text-foreground-muted mb-4">{t('last_24h')}</p>

      {loading && (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-20 rounded-xl bg-foreground/5 animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-error/20 bg-error/5 p-4 mb-4">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {data && !loading && (
        <div className="flex flex-col gap-5">
          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-3">
            <KpiCard
              value={data.incident_count.total}
              label={t('incidents')}
              sublabel={`${data.incident_count.severe} ${t('severe')}, ${data.incident_count.mild} ${t('mild')}`}
              urgency={data.incident_count.severe > 0 ? 'alert' : undefined}
            />
            <KpiCard
              value={`${data.escalating_residents.length}`}
              label={t('escalating')}
              urgency={data.escalating_residents.length > 0 ? 'warning' : undefined}
            />
            <KpiCard
              value={`${data.staff_adoption.active_users}/${data.staff_adoption.total_staff}`}
              label={t('staff_active')}
              sublabel={`${data.staff_adoption.percentage}%`}
              urgency={data.staff_adoption.percentage >= 80 ? 'positive' : undefined}
            />
          </div>

          {/* Escalating residents */}
          {data.escalating_residents.length > 0 && (
            <section>
              <h2 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
                <span className="text-yellow-600">⚠</span>
                {t('escalating_residents')}
              </h2>
              <div className="card-shell rounded-xl divide-y divide-foreground/5">
                {data.escalating_residents.map((r, i) => (
                  <div key={i} className="px-4 py-3">
                    <p className="text-sm font-medium text-foreground">
                      Resident {r.profile_id.slice(0, 6).toUpperCase()} — {r.category} {r.trend}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Family activity */}
          {data.family_sessions.count > 0 && (
            <section>
              <h2 className="text-base font-bold text-foreground mb-3">{t('family_activity')}</h2>
              <div className="card-shell rounded-xl px-4 py-3">
                <p className="text-sm text-foreground">
                  {data.family_sessions.count} {t('family_sessions')}
                </p>
              </div>
            </section>
          )}

          {/* Export */}
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="focus-ring rounded-full bg-primary text-onPrimary px-4 py-3 min-h-[48px] text-base font-semibold hover:bg-primary-light dark:hover:bg-primary-light active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {exporting ? `${t('export_pdf')}…` : t('export_pdf')}
          </button>
        </div>
      )}
    </main>
  );
}
