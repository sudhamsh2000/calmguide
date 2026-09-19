'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * Mobile bottom navigation, matching the supplied CalmGuide mobile references.
 *
 * Mapped onto the app's EXISTING routes — no new pages, no route changes:
 *   Coach     -> /coach      (Moment Coach, the primary experience)
 *   Insights  -> /incidents  (incident history + the pattern insights on it)
 *   Resources -> /learn      (practice scenarios / educational content)
 *   More      -> /profile    (profile, settings, appearance, sign-out)
 *
 * The references show a 5th "Log" action on the Incident Log screen only, and
 * disagree with each other on tab count. We use a consistent 4 everywhere
 * instead — logging is already reachable from Home and from /incidents, and a
 * nav bar that changes shape between screens is exactly the kind of
 * cognitive load the 3am brief argues against.
 *
 * Hidden on `lg:` and up, where `PrimaryNav` takes over — in the shell
 * header on most screens, and down the dashboard's own rail. That desktop
 * navigation was missing until 2026-09-19: this comment promised it, but
 * nothing rendered it, so at desktop width the app had no nav at all.
 * Also hidden on the landing page and facility (B2B) routes, which have
 * their own chrome — see `shouldShowBottomNav`.
 */

export interface NavItem {
  href: '/coach' | '/incidents' | '/learn' | '/profile';
  labelKey: string;
  icon: React.ReactNode;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: '/coach',
    labelKey: 'bottom_nav.coach',
    icon: (
      <>
        <path d="M12 3 4 9v11h5v-6h6v6h5V9l-8-6Z" />
      </>
    ),
  },
  {
    href: '/incidents',
    labelKey: 'bottom_nav.insights',
    icon: (
      <>
        <path d="M5 20V10M12 20V4M19 20v-7" />
      </>
    ),
  },
  {
    href: '/learn',
    labelKey: 'bottom_nav.resources',
    icon: (
      <>
        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 16.5v-11Z" />
        <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h4.5a1.5 1.5 0 0 0 1.5-1.5v-11Z" />
      </>
    ),
  },
  {
    href: '/profile',
    labelKey: 'bottom_nav.more',
    icon: (
      <>
        <circle cx="5" cy="12" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="19" cy="12" r="1.5" />
      </>
    ),
  },
];

/**
 * The bottom nav belongs to the caregiver app shell only. The landing page
 * runs its own marketing chrome, and facility (B2B) mode has its own
 * navigation and a denser layout, so neither should get it.
 */
export function shouldShowBottomNav(pathname: string): boolean {
  if (pathname === '/') return false;
  if (pathname.startsWith('/facility')) return false;
  return true;
}

export function BottomNav() {
  const t = useTranslations('common');
  const pathname = usePathname();

  if (!shouldShowBottomNav(pathname)) return null;

  return (
    <nav
      aria-label={t('bottom_nav.label')}
      className="shrink-0 border-t border-theme-soft bg-surface lg:hidden"
    >
      <ul className="mx-auto flex w-full max-w-lg items-stretch justify-around">
        {NAV_ITEMS.map((item) => {
          // Treat nested routes as "on" their section (e.g. /incidents/new
          // keeps Insights active) so the indicator never blanks out mid-flow.
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`focus-ring flex min-h-tap flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-semibold transition-colors ${
                  isActive ? 'text-primary' : 'text-foreground-muted hover:text-foreground'
                }`}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
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
