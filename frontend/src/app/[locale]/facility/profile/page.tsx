'use client';

import { useMemo } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useFacility } from '@/context/FacilityContext';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const ROLE_LABELS: Record<string, string> = {
  staff: 'Care Staff',
  admin: 'Administrator',
  owner: 'Executive',
};

export default function FacilityProfilePage() {
  const t = useTranslations('facility');
  const tc = useTranslations('common');
  const { state, logout } = useFacility();

  const roleLabel = useMemo(() => {
    const role = state.staff?.role ?? '';
    return ROLE_LABELS[role] ?? role;
  }, [state.staff?.role]);

  if (!state.staff) return null;

  return (
    <main className="flex flex-col h-full overflow-y-auto px-5 py-6">
      <div className="mx-auto w-full max-w-lg space-y-5">
        <header>
          <p className="text-sm text-foreground-muted">{tc('nav.profile')}</p>
          <h1
            className="mt-1 text-2xl font-medium text-foreground"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {state.staff.name}
          </h1>
          <p className="mt-1 text-sm text-foreground-muted">
            {roleLabel}
            {state.facilityName ? ` · ${state.facilityName}` : ''}
          </p>
        </header>

        <section className="card-shell px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">
            Appearance
          </p>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="text-base font-medium text-foreground">Theme</p>
              <p className="text-sm text-foreground-muted">Switch between light and dark mode</p>
            </div>
            <ThemeToggle />
          </div>
        </section>

        {state.staff.role === 'staff' && (
          <Link
            href="/facility/residents"
            className="flex min-h-tap items-center justify-center rounded-2xl border border-border dark:border-theme-soft bg-surface px-6 py-3.5 text-base font-semibold text-foreground transition-all hover:border-primary/20 hover:bg-primary/[0.025] hover:text-primary dark:hover:border-primary/25 dark:hover:bg-primary/[0.05] focus-ring"
          >
            {t('nav.my_residents')}
          </Link>
        )}

        {(state.staff.role === 'admin' || state.staff.role === 'owner') && (
          <Link
            href="/facility/settings"
            className="flex min-h-tap items-center justify-center rounded-2xl border border-border dark:border-theme-soft bg-surface px-6 py-3.5 text-base font-semibold text-foreground transition-all hover:border-primary/20 hover:bg-primary/[0.025] hover:text-primary dark:hover:border-primary/25 dark:hover:bg-primary/[0.05] focus-ring"
          >
            {t('nav.settings')}
          </Link>
        )}

        <button
          type="button"
          onClick={logout}
          className="danger-outline-button flex min-h-tap w-full items-center justify-center rounded-2xl px-6 py-3.5 text-base font-semibold focus-ring cursor-pointer"
        >
          {t('login.quick_switch')}
        </button>
      </div>
    </main>
  );
}
