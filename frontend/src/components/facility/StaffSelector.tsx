"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { StaffListItem } from "@/lib/facility-api";

interface StaffSelectorProps {
  staff: StaffListItem[];
  selectedId: string | null;
  onSelect: (staff: StaffListItem) => void;
  loading?: boolean;
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function StaffSelector({
  staff,
  selectedId,
  onSelect,
  loading = false,
  className = "",
}: StaffSelectorProps) {
  const t = useTranslations("facility.login");
  const [localSelected, setLocalSelected] = useState<StaffListItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  if (loading) {
    return (
      <div className={`flex flex-col items-center gap-6 ${className}`}>
        <h2 className="w-full text-xl font-semibold text-foreground" style={{ textAlign: "start" }}>
          {t("who_is_here")}
        </h2>
        <div className="flex flex-wrap justify-center gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="size-14 rounded-full bg-foreground/10 animate-pulse" />
              <div className="h-4 w-16 rounded bg-foreground/10 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (staff.length === 0) return null;

  const showSearch = staff.length >= 10;
  const filteredStaff = showSearch && searchQuery.trim()
    ? staff.filter((s) => s.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : staff;

  const activeId = localSelected?.id ?? selectedId;

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      <h2 className="text-xl font-semibold text-foreground text-center">
        {t("who_is_here")}
      </h2>

      {showSearch && (
        <div className="sticky top-0 z-10 px-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Find your name…"
            className="field-shell h-12 w-full rounded-full px-5 text-base"
          />
        </div>
      )}

      {filteredStaff.length === 0 && searchQuery.trim() ? (
        <p className="text-sm text-foreground-muted text-center py-4">
          No one named &lsquo;{searchQuery.trim()}&rsquo; found
        </p>
      ) : (
        <div className="flex flex-wrap justify-center gap-4">
          {filteredStaff.map((s) => {
            const isActive = activeId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setLocalSelected(s)}
                className={`flex flex-col items-center gap-2.5 p-4 min-w-[88px] rounded-2xl border transition-all cursor-pointer ${
                  isActive
                    ? "border-primary/60 bg-primary/[0.07] dark:border-primary/45 dark:bg-primary/[0.11] shadow-[inset_0_0_0_1px_rgba(58,175,169,0.22)]"
                    : "border-border dark:border-[#31445f] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_0_0_1px_rgba(26,35,50,0.14)] hover:border-primary/20 hover:bg-primary/[0.025] dark:hover:border-primary/25 dark:hover:bg-primary/[0.05]"
                }`}
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold text-white transition-colors bg-primary"
                  style={{ opacity: isActive ? 1 : 0.85 }}
                >
                  {getInitials(s.name)}
                </div>
                <span className="text-sm font-medium text-foreground text-center leading-tight">
                  {s.name}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Confirm button */}
      {localSelected && (
        <button
          type="button"
          onClick={() => onSelect(localSelected)}
          className="focus-ring w-full h-12 rounded-xl bg-primary text-white font-semibold text-base transition-all hover:bg-primary-light dark:hover:bg-primary-light active:scale-[0.98]"
        >
          Continue as <bdi>{localSelected.name.split(/\s+/)[0]}</bdi>
        </button>
      )}
    </div>
  );
}
