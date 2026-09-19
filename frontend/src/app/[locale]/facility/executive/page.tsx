'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRequireRole } from '@/hooks/useRequireRole';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { KpiCard } from '@/components/facility/KpiCard';
import { useFacility } from '@/context/FacilityContext';
import { downloadReport, getExecutiveOverview } from '@/lib/facility-api';
import type { ExecutiveOverview } from '@/lib/facility-api';

export default function ExecutivePage() {
  const { allowed } = useRequireRole('admin', 'owner');

  const t = useTranslations('facility.executive');
  const params = useParams();
  const router = useRouter();
  const locale = (params.locale as string) ?? 'en';
  const { state } = useFacility();

  const [data, setData] = useState<ExecutiveOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const overview = await getExecutiveOverview();
      setData(overview);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (state.authenticated) load();
  }, [state.authenticated, load]);

  const handleExportReport = useCallback(async () => {
    setExporting(true);
    setExportError(null);
    try {
      await downloadReport(30);
    } catch {
      setExportError(t('unavailable'));
    } finally {
      setExporting(false);
    }
  }, [t]);

  if (!allowed) return null;

  return (
    <main className="flex flex-col h-full overflow-y-auto px-5 py-6">
      <h1 className="text-xl font-bold text-foreground mb-6">{t('title')}</h1>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-24 rounded-xl bg-foreground/5 animate-pulse" />
            ))}
          </div>
          <div className="h-48 rounded-xl bg-foreground/5 animate-pulse" />
        </div>
      ) : data ? (
        <>
          <p className="text-sm text-foreground-muted mb-4">
            {t('since_implementing', { days: String(data.days_active) })}
          </p>

          {/* KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <KpiCard
              value={`${data.incident_rate.change_pct > 0 ? '+' : ''}${data.incident_rate.change_pct}%`}
              label={t('incident_reduction')}
              trend={data.incident_rate.change_pct < 0 ? 'down' : 'up'}
            />
            <KpiCard value={`${data.adoption_rate.staff_pct}%`} label={t('staff_adoption')} />
          </div>

          {/* Monthly Impact */}
          <section className="mb-8">
            <h2 className="text-base font-bold text-foreground mb-3">{t('monthly_impact')}</h2>
            <div className="rounded-xl border border-foreground/[.06] bg-surface dark:border-white/[.12] dark:bg-white/[.03] divide-y divide-foreground/[.04] dark:divide-white/[.08]">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-foreground">{t('survey_readiness')}</span>
                <span className="text-sm font-semibold text-foreground">&#10003;</span>
              </div>
            </div>
          </section>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleExportReport}
              disabled={exporting}
              className="h-10 px-4 rounded-full bg-primary text-onPrimary text-sm font-medium hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {exporting ? `${t('export_report')}…` : t('export_report')}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/${locale}/facility/staff`)}
              className="outline-button h-10 rounded-lg px-4 text-sm font-medium"
            >
              {t('manage_accounts')}
            </button>
          </div>
          {exportError && <p className="mt-3 text-sm text-error">{exportError}</p>}
        </>
      ) : null}
    </main>
  );
}
