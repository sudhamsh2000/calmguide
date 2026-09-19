import { getImpact } from '@/lib/api';
import type { ImpactResponse } from '@/lib/api';
import { getTranslations } from 'next-intl/server';
import { BackButton } from '@/components/ui/BackButton';

async function fetchImpact(): Promise<ImpactResponse | null> {
  try {
    return await getImpact();
  } catch {
    return null;
  }
}

function Stat({ value, label, sub }: { value: string | number; label: string; sub?: string }) {
  return (
    <div className="card-shell flex flex-col items-center gap-1.5 px-5 py-6">
      <span
        className="text-4xl font-bold tracking-tight text-foreground"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {value}
      </span>
      <span className="text-center text-sm font-medium text-foreground">{label}</span>
      {sub && <span className="text-center text-xs text-foreground-muted">{sub}</span>}
    </div>
  );
}

export default async function ImpactPage() {
  const [data, t, tc] = await Promise.all([
    fetchImpact(),
    getTranslations('impact'),
    getTranslations('common'),
  ]);

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-4 pb-24 sm:px-5 sm:py-6 lg:max-w-app">
      <div className="mb-4">
        <BackButton href="/home" label={tc('nav.back_to_home')} />
      </div>
      <h1
        className="text-[26px] font-medium text-foreground leading-tight"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {t('title')}
      </h1>
      <p className="mt-2 text-sm text-foreground-muted">{t('subtitle')}</p>

      {data ? (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              value={data.families_supported.toLocaleString()}
              label={t('families_supported')}
              sub={t('families_supported_sub')}
            />
            <Stat
              value={data.coached_sessions.toLocaleString()}
              label={t('coached_sessions')}
              sub={t('coached_sessions_sub')}
            />
            <Stat
              value={data.languages_served}
              label={t('languages_served')}
              sub={t('languages_served_sub')}
            />
            <Stat
              value={`${data.overnight_pct}%`}
              label={t('overnight_pct')}
              sub={t('overnight_pct_sub')}
            />
          </div>

          <div className="mt-3 rounded-2xl bg-panelDark px-5 py-5 text-center">
            <span
              className="text-3xl font-bold text-white"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {data.sessions_this_week.toLocaleString()}
            </span>
            <p className="mt-1 text-sm text-white/70">{t('sessions_this_week')}</p>
          </div>

          <p className="mt-6 text-center text-xs text-foreground-muted italic">{t('closing')}</p>
        </>
      ) : (
        <p className="mt-8 text-foreground-muted">{t('unavailable')}</p>
      )}
    </main>
  );
}
