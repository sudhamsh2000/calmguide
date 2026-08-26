"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useFacility } from "@/context/FacilityContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface SidebarProps {
  className?: string;
}

interface NavItem {
  key: string;
  href: string;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", href: "/facility/dashboard", roles: ["admin"] },
  { key: "executive", href: "/facility/executive", roles: ["owner"] },
  { key: "residents", href: "/facility/residents-all", roles: ["admin"] },
  { key: "trends", href: "/facility/trends", roles: ["admin"] },
  { key: "staff", href: "/facility/staff", roles: ["admin", "owner"] },
  { key: "audit", href: "/facility/audit", roles: ["admin", "owner"] },
  { key: "settings", href: "/facility/settings", roles: ["admin", "owner"] },
];

const NAV_ICONS: Record<string, React.ReactNode> = {
  executive: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
      <path fillRule="evenodd" d="M1 2.75A.75.75 0 011.75 2h16.5a.75.75 0 010 1.5H18v8.75A2.75 2.75 0 0115.25 15h-1.072l.798 3.06a.75.75 0 01-1.452.38L13.41 18H6.59l-.114.44a.75.75 0 01-1.452-.38L5.822 15H4.75A2.75 2.75 0 012 12.25V3.5h-.25A.75.75 0 011 2.75zM7.373 15l-.391 1.5h6.037l-.392-1.5H7.373z" clipRule="evenodd" />
    </svg>
  ),
  dashboard: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
      <path d="M15.5 2A1.5 1.5 0 0014 3.5v13a1.5 1.5 0 001.5 1.5h1a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0016.5 2h-1zM9.5 6A1.5 1.5 0 008 7.5v9A1.5 1.5 0 009.5 18h1a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0010.5 6h-1zM3.5 10A1.5 1.5 0 002 11.5v5A1.5 1.5 0 003.5 18h1A1.5 1.5 0 006 16.5v-5A1.5 1.5 0 004.5 10h-1z" />
    </svg>
  ),
  residents: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
      <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM14.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.636.818.818 0 01-.36.98A7.465 7.465 0 0114.5 16z" />
    </svg>
  ),
  trends: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
      <path fillRule="evenodd" d="M12.577 4.878a.75.75 0 01.919-.53l4.78 1.281a.75.75 0 01.531.919l-1.281 4.78a.75.75 0 01-1.449-.387l.81-3.022a19.407 19.407 0 00-5.594 5.203.75.75 0 01-1.139.093L7 10.06l-4.72 4.72a.75.75 0 01-1.06-1.06l5.25-5.25a.75.75 0 011.06 0l3.074 3.073a20.923 20.923 0 015.545-4.931l-3.042.815a.75.75 0 01-.53-.919z" clipRule="evenodd" />
    </svg>
  ),
  staff: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
      <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.975 6.975 0 01-4.696-1.81z" />
    </svg>
  ),
  audit: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
      <path fillRule="evenodd" d="M15.988 3.012A2.25 2.25 0 0118 5.25v6.5A2.25 2.25 0 0115.75 14H13.5v-3.379a3 3 0 00-.879-2.121l-3.12-3.121a3 3 0 00-1.402-.791 2.252 2.252 0 011.913-1.576A2.25 2.25 0 0112.25 1h1.5a2.25 2.25 0 012.238 2.012zM11.5 3.25a.75.75 0 01.75-.75h1.5a.75.75 0 01.75.75v.25a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75v-.25z" clipRule="evenodd" />
      <path d="M3.5 6A1.5 1.5 0 002 7.5v9A1.5 1.5 0 003.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L8.44 6.439A1.5 1.5 0 007.378 6H3.5z" />
    </svg>
  ),
  settings: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
      <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  ),
};

export function Sidebar({ className = "" }: SidebarProps) {
  const t = useTranslations("facility.nav");
  const tc = useTranslations("common");
  const params = useParams();
  const pathname = usePathname();
  const { state, logout } = useFacility();
  const locale = (params.locale as string) ?? "en";
  const role = state.staff?.role ?? "";

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside
      className={`w-[280px] lg:w-[320px] shrink-0 flex flex-col border-r border-foreground/10 bg-surface h-dvh ${className}`}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-foreground/10">
        <p className="text-sm font-bold text-primary tracking-wide">CalmGuide</p>
        {state.facilityName && (
          <p className="text-sm text-foreground-muted mt-0.5">{state.facilityName}</p>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3">
        {visibleItems.map((item) => {
          const fullHref = `/${locale}${item.href}`;
          const isActive = pathname.startsWith(fullHref);
          return (
            <Link
              key={item.key}
              href={fullHref}
              className={`flex h-11 items-center gap-3 px-5 text-sm font-medium transition-colors ${
                isActive ? "bg-primary/5 text-primary" : "text-foreground hover:bg-foreground/5"
              }`}
              style={
                isActive
                  ? {
                      borderInlineStart: "3px solid rgb(58 175 169)",
                      paddingInlineStart: "17px",
                    }
                  : undefined
              }
            >
              {NAV_ICONS[item.key]}
              {t(item.key as "dashboard" | "executive" | "residents" | "trends" | "staff" | "audit" | "settings")}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="px-5 py-4 border-t border-foreground/10">
        {state.staff && (
          <p className="text-sm font-medium text-foreground mb-2">{state.staff.name}</p>
        )}
        <div className="mb-3 flex items-center justify-between">
          <Link
            href={`/${locale}/facility/profile`}
            className="text-sm text-foreground hover:text-primary transition-colors"
          >
            {tc("nav.profile")}
          </Link>
          <ThemeToggle className="h-10 w-10" />
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
            <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.598a.75.75 0 00-.75.75v3.634a.75.75 0 001.5 0v-2.033l.312.312a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.06-7.846a.75.75 0 00-1.5 0v2.033l-.312-.312a7 7 0 00-11.712 3.138.75.75 0 001.449.39 5.5 5.5 0 019.201-2.466l.312.311h-2.433a.75.75 0 000 1.5h3.634a.75.75 0 00.75-.75V3.578z" clipRule="evenodd" />
          </svg>
          Switch User
        </button>
      </div>
    </aside>
  );
}
