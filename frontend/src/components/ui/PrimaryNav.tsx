'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { NAV_ITEMS, shouldShowBottomNav } from './BottomNav';

/**
 * The desktop counterpart to `BottomNav`, for `lg:` and up.
 *
 * Same four destinations, same active-section rule, same translation keys —
 * it imports the item list rather than restating it, because two nav
 * definitions drift and a caregiver learning one set of names is the whole
 * point of having them.
 *
 * Two placements, because the desktop layout has two shapes:
 *   `header` — a horizontal row in the app shell header, used on every
 *              screen that has one.
 *   `rail`   — a vertical list down the dashboard's left rail, which hides
 *              the shell header at lg+ and is already the column your eye
 *              goes to for "where do I go next".
 *
 * A bottom bar is a phone idiom; reusing it on a 1440px display would put
 * the primary navigation as far from the content as it can physically get.
 */

export interface PrimaryNavProps {
  placement: 'header' | 'rail';
  className?: string;
}

export function PrimaryNav({ placement, className = '' }: PrimaryNavProps) {
  const t = useTranslations('common');
  const pathname = usePathname();

  // Same scope rule as the bottom nav: the landing page and facility mode
  // run their own chrome.
  if (!shouldShowBottomNav(pathname)) return null;

  const isRail = placement === 'rail';

  return (
    <nav
      aria-label={t('bottom_nav.label')}
      className={[isRail ? 'hidden lg:block' : 'hidden lg:block', className].join(' ')}
    >
      <ul className={isRail ? 'flex flex-col gap-1' : 'flex items-center gap-1'}>
        {NAV_ITEMS.map((item) => {
          // Nested routes keep their section active (e.g. /incidents/new
          // keeps Insights lit), matching BottomNav exactly.
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className={isRail ? '' : 'shrink-0'}>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'focus-ring flex items-center gap-2.5 rounded-xl text-sm font-semibold transition-colors',
                  isRail ? 'min-h-tap px-3 py-2.5' : 'min-h-tap px-3 py-2',
                  // The active fill is `bg-accentSky-soft`, not a Tailwind
                  // opacity modifier: these colour tokens are bare `var()`
                  // values, and `bg-primary/10` on one compiles to
                  // transparent in Tailwind 3.4.
                  isActive
                    ? 'bg-accentSky-soft text-foreground'
                    : 'text-foreground-muted hover:bg-primary-soft hover:text-foreground',
                ].join(' ')}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="shrink-0"
                >
                  {item.icon}
                </svg>
                <span>{t(item.labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
