'use client';

import { useTranslations } from 'next-intl';

const linkBase =
  'inline-flex min-h-[48px] items-center justify-center px-3 py-1.5 text-sm font-semibold transition-colors';

export function EmergencyBar() {
  const tc = useTranslations('common');
  return (
    <div
      className="shrink-0 flex items-center justify-center flex-wrap bg-error/8 dark:bg-white/[0.02] border-t border-error/10 dark:border-white/[0.06]"
      role="complementary"
      aria-label={tc('emergency.label')}
    >
      <a
        href="tel:911"
        aria-label={tc('emergency.call_911')}
        className={`${linkBase} text-error hover:bg-error/20`}
      >
        <span className="rounded-md bg-error px-3 py-1.5 text-base font-bold leading-tight text-white">
          911
        </span>
      </a>
      <a
        href="tel:988"
        aria-label={tc('emergency.call_988')}
        className={`${linkBase} text-error hover:bg-error/10`}
      >
        <span className="rounded-md border border-error/20 bg-error/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] dark:border-white/[0.06] dark:bg-error/[0.025] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] px-3 py-1.5 text-sm font-semibold leading-tight">
          {tc('emergency.crisis_line')}
        </span>
      </a>
      <a
        href="tel:18002723900"
        aria-label={tc('emergency.call_alz')}
        className={`${linkBase} text-primary hover:bg-primary/10`}
      >
        <span className="rounded-md border border-primary/20 bg-primary/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] dark:border-white/[0.06] dark:bg-primary/[0.025] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] px-3 py-1.5 text-sm font-semibold leading-tight">
          {tc('emergency.alz_helpline')}
        </span>
      </a>
    </div>
  );
}
