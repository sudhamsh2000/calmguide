'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRequireRole } from '@/hooks/useRequireRole';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useFacility } from '@/context/FacilityContext';
import { getStaffList } from '@/lib/facility-api';
import type { StaffInfo } from '@/lib/facility-api';

export default function StaffListPage() {
  const { allowed } = useRequireRole('admin', 'owner');

  const t = useTranslations('facility.staff');
  const tEmpty = useTranslations('facility.empty');
  const params = useParams();
  const locale = (params.locale as string) ?? 'en';
  const { state } = useFacility();
  const facilityCode = state.facilityCode ?? '';

  const [staff, setStaff] = useState<StaffInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!facilityCode) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getStaffList(facilityCode);
      setStaff(data.staff);
    } catch (err) {
      console.error('Failed to load staff list', err);
      setError('Could not load staff right now. Try refreshing in a moment.');
    } finally {
      setLoading(false);
    }
  }, [facilityCode]);

  useEffect(() => {
    if (state.authenticated) load();
  }, [state.authenticated, load]);

  const active = staff.filter((s) => s.is_active);

  if (!allowed) return null;

  return (
    <main className="flex flex-col h-full overflow-y-auto px-5 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <Link
          href={`/${locale}/facility/staff/new`}
          className="h-10 px-4 flex items-center rounded-full bg-primary text-onPrimary text-sm font-medium hover:bg-primary-light transition-colors"
        >
          + {t('add_staff')}
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-error/20 bg-error/5 p-4 mb-4">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-12 rounded-lg bg-foreground/5 animate-pulse" />
          ))}
        </div>
      ) : staff.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="size-12 text-foreground/20 mb-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
            />
          </svg>
          <h2 className="text-lg font-semibold text-foreground mb-1">{tEmpty('staff_title')}</h2>
          <p className="text-sm text-foreground-muted max-w-xs mb-4">
            {tEmpty('staff_description')}
          </p>
          <Link
            href={`/${locale}/facility/staff/new`}
            className="h-12 px-6 flex items-center rounded-full bg-primary text-onPrimary font-semibold hover:bg-primary-light transition-colors"
          >
            {tEmpty('staff_cta')}
          </Link>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-foreground/[.06] bg-background/80 dark:border-white/[.12] dark:bg-white/[.02]">
            <table className="w-full text-start text-sm">
              <thead className="bg-foreground/[.02] dark:bg-white/[.015]">
                <tr>
                  <th className="px-4 py-3 font-medium text-foreground-muted">{t('name')}</th>
                  <th className="px-4 py-3 font-medium text-foreground-muted">{t('role')}</th>
                  <th className="px-4 py-3 font-medium text-foreground-muted">
                    {t('residents_col')}
                  </th>
                  <th className="px-4 py-3 font-medium text-foreground-muted">
                    {t('last_active')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/[.04] dark:divide-white/[.08]">
                {staff.map((s) => (
                  <tr key={s.id} className="hover:bg-foreground/[.02] transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/${locale}/facility/staff/${s.id}/assign`}
                        className="font-medium text-accentSky hover:underline"
                      >
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-foreground capitalize">{s.role}</td>
                    <td className="px-4 py-3 text-foreground">
                      {s.role === 'admin' ? 'All' : s.assigned_patients_count}
                    </td>
                    <td className="px-4 py-3 text-foreground-muted text-xs">
                      {s.last_login_at
                        ? new Date(s.last_login_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })
                        : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-foreground-muted mt-3">
            {t('showing_active', { count: active.length })}
          </p>
        </>
      )}
    </main>
  );
}
