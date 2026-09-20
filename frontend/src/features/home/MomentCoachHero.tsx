'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { AiSphere } from './AiSphere';

/**
 * The dashboard's primary "act now" card. Deliberately the only dark
 * surface on the screen and the only thing that moves, so that in a
 * hallway at 3 a.m. the eye lands here first and nowhere else.
 *
 * `bg-panelDark` rather than `bg-primary`: this panel has to stay dark in
 * both themes, and primary inverts to near-white in dark mode.
 */
export interface MomentCoachHeroProps {
  className?: string;
}

export function MomentCoachHero({ className = '' }: MomentCoachHeroProps) {
  const t = useTranslations('home');

  return (
    <Link href="/coach" className={`group block ${className}`}>
      <div className="relative h-full min-h-[260px] lg:min-h-[320px] overflow-hidden rounded-[32px] border border-transparent bg-panelDark dark:border-white/[0.08] px-6 py-7 transition-all duration-200 group-hover:ring-2 group-hover:ring-accentSky/40 group-hover:ring-offset-2 group-focus-visible:outline-none group-focus-visible:ring-3 group-focus-visible:ring-accentSky group-focus-visible:ring-offset-2 active:scale-[0.995] sm:px-8 sm:py-9">
        {/* Sphere sits behind the copy and bleeds off the right edge, so the
         * text never has to compete with the brightest part of it. Hidden
         * below sm: at phone width there isn't room for both. */}
        <AiSphere className="pointer-events-none absolute end-0 top-1/2 hidden h-[280px] w-[280px] -translate-y-1/2 sm:block lg:end-3 lg:h-[350px] lg:w-[350px]" />

        {/* Keeps the headline legible where it overlaps the sphere's glow. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, var(--color-panel-dark) 0%, color-mix(in srgb, var(--color-panel-dark) 82%, transparent) 42%, transparent 72%)',
          }}
        />

        <div className="relative max-w-[22rem]">
          <p className="text-sm font-medium text-white/70">{t('coach_card.eyebrow')}</p>
          <p
            className="mt-2 text-2xl font-semibold leading-snug text-white sm:text-[27px]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('coach_card.title')}
          </p>
          <p className="mt-2.5 text-sm text-white/70">{t('coach_card.subtitle')}</p>
        </div>
      </div>
    </Link>
  );
}
