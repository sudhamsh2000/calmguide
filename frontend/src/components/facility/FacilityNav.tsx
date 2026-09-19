'use client';

import { Link } from '@/i18n/navigation';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useFacility } from '@/context/FacilityContext';
import { getFacilityName } from '@/lib/facility-storage';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

interface NavItem {
  key: string;
  href: string;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { key: 'my_residents', href: '/facility/residents', roles: ['staff'] },
  { key: 'dashboard', href: '/facility/dashboard', roles: ['admin'] },
  { key: 'executive', href: '/facility/executive', roles: ['owner'] },
  { key: 'residents', href: '/facility/residents-all', roles: ['admin'] },
  { key: 'trends', href: '/facility/trends', roles: ['admin'] },
  { key: 'staff', href: '/facility/staff', roles: ['admin', 'owner'] },
  { key: 'audit', href: '/facility/audit', roles: ['admin', 'owner'] },
  { key: 'settings', href: '/facility/settings', roles: ['admin', 'owner'] },
];

export function FacilityNav() {
  const t = useTranslations('facility.nav');
  const pathname = usePathname();
  const { state, logout } = useFacility();
  const role = state.staff?.role ?? '';
  const displayName = state.facilityName || getFacilityName() || '';
  const isProfileActive = pathname.includes('/facility/profile');
  const profileLabel = state.staff?.name.split(/\s+/)[0] ?? '';

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <div className="bg-background border-b border-foreground/10">
      <div className="px-4 py-2.5 space-y-1">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-primary tracking-wide leading-none">
              CalmGuide
            </p>
            {displayName && (
              <p className="mt-1 truncate text-xs text-foreground-muted">
                <bdi>{displayName}</bdi>
              </p>
            )}
          </div>
          <ThemeToggle className="h-8 w-8 shrink-0 !min-h-0" />
        </div>
        {state.staff && (
          <div className="flex items-center justify-between gap-3 text-xs">
            <Link
              href="/facility/profile"
              className={`min-w-0 truncate font-medium transition-colors !min-h-0 ${
                isProfileActive ? 'text-primary' : 'text-foreground-muted hover:text-primary'
              }`}
            >
              <bdi>{profileLabel}</bdi>
            </Link>
            <button
              type="button"
              onClick={logout}
              className="shrink-0 text-primary transition-colors hover:text-primary-light !min-h-0"
            >
              Switch
            </button>
          </div>
        )}
      </div>

      {/* Nav tabs — only for admin/owner */}
      {visibleItems.length > 0 && (
        <nav className="overflow-x-auto px-4 pt-1 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max min-w-full gap-2">
            {visibleItems.map((item) => {
              const isActive = pathname.includes(item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex min-h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-onPrimary shadow-sm'
                      : 'bg-surface text-foreground hover:bg-foreground/5'
                  }`}
                >
                  {t(
                    item.key as
                      | 'my_residents'
                      | 'dashboard'
                      | 'executive'
                      | 'residents'
                      | 'trends'
                      | 'staff'
                      | 'audit'
                      | 'settings',
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
