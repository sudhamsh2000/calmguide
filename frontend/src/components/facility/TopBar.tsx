"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useFacility } from "@/context/FacilityContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface TopBarProps {
  className?: string;
}

export function TopBar({ className = "" }: TopBarProps) {
  const t = useTranslations("facility");
  const tc = useTranslations("common");
  const { state, logout } = useFacility();

  return (
    <header
      className={`flex items-center justify-between px-4 py-3 border-b border-foreground/10 bg-surface shrink-0 ${className}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-primary tracking-wide">CalmGuide</p>
        {state.facilityName && (
          <p className="text-xs text-foreground-muted truncate">
            <bdi>{state.facilityName}</bdi>
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle className="h-10 w-10 shrink-0" />
        <div className="flex flex-col items-end shrink-0">
          {state.staff && (
            <Link href="/facility/profile" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              <bdi>{state.staff.name}</bdi>
            </Link>
          )}
          <div className="flex items-center gap-2 text-xs">
            <Link href="/facility/profile" className="text-foreground-muted hover:text-foreground transition-colors">
              {tc("nav.profile")}
            </Link>
            <span className="text-foreground-muted/40">·</span>
            <button
              type="button"
              onClick={logout}
              aria-label="Switch user"
              className="text-primary hover:text-primary-light transition-colors"
            >
              Switch
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
