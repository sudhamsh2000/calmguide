'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ResidentCard } from '@/components/facility/ResidentCard';
import { useFacility } from '@/context/FacilityContext';
import { getMyResidents, FacilityApiError } from '@/lib/facility-api';
import type { ResidentSummary } from '@/lib/facility-api';

export default function MyResidentsPage() {
  const t = useTranslations('facility');
  const params = useParams();
  const locale = (params.locale as string) ?? 'en';
  const { state } = useFacility();

  const [residents, setResidents] = useState<ResidentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadResidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyResidents();
      setResidents(data.residents);
    } catch (err) {
      if (err instanceof FacilityApiError && err.status === 401) {
        setError(
          "You've been signed out for safety. Your data is safe — sign back in to continue.",
        );
      } else {
        setError('Resident list unavailable right now. Your residents are still on record.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (state.authenticated) {
      loadResidents();
    }
  }, [state.authenticated, loadResidents]);

  return (
    <main className="flex flex-col h-full overflow-y-auto px-5 py-6">
      <h1 className="text-xl font-bold text-foreground mb-4">{t('residents.title')}</h1>

      {loading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-28 rounded-xl bg-foreground/5 animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-error/20 bg-error/5 p-4">
          <p className="text-sm text-error">{error}</p>
          <button
            type="button"
            onClick={loadResidents}
            className="mt-2 text-sm font-medium text-accentSky hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && residents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h2 className="text-lg font-semibold text-foreground mb-1">
            {t('residents.no_residents')}
          </h2>
          <p className="text-sm text-foreground-muted max-w-xs">
            {t('residents.no_residents_subtitle')}
          </p>
        </div>
      )}

      {!loading && !error && residents.length > 0 && (
        <div className="flex flex-col gap-3">
          {residents.map((r) => (
            <ResidentCard key={r.profile_id} resident={r} locale={locale} />
          ))}
        </div>
      )}
    </main>
  );
}
