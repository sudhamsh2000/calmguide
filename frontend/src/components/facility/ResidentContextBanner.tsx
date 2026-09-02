'use client';

import { formatResidentLocation } from '@/lib/facility-utils';

type RiskLevel = 'high' | 'moderate' | 'low';

interface ResidentContextBannerProps {
  unit: string | null;
  room: string | null;
  bed: string | null;
  riskLevel: RiskLevel;
}

const RISK_BANNER: Record<RiskLevel, { bg: string; badgeBg: string; badgeText: string }> = {
  high: {
    bg: 'bg-[#FFFBFB] dark:bg-red-950/10',
    badgeBg: 'bg-red-100 dark:bg-red-950/40',
    badgeText: 'text-red-800 dark:text-red-300',
  },
  moderate: {
    bg: 'bg-[#FFFDF8] dark:bg-orange-950/10',
    badgeBg: 'bg-orange-100 dark:bg-orange-950/40',
    badgeText: 'text-orange-800 dark:text-orange-300',
  },
  low: {
    bg: 'bg-[#FBFFFC] dark:bg-green-950/10',
    badgeBg: 'bg-green-100 dark:bg-green-950/40',
    badgeText: 'text-green-800 dark:text-green-300',
  },
};

const RISK_LABELS: Record<RiskLevel, string> = {
  high: 'High',
  moderate: 'Moderate',
  low: 'Low',
};

export function ResidentContextBanner({ unit, room, bed, riskLevel }: ResidentContextBannerProps) {
  const risk = RISK_BANNER[riskLevel] ?? RISK_BANNER.low;
  const location = formatResidentLocation(unit, room, bed, true);

  return (
    <div
      className={`sticky top-0 z-10 shrink-0 flex items-center justify-between rounded-2xl border border-foreground/10 px-5 py-4 shadow-[0_1px_2px_rgba(23,37,42,0.04)] dark:border-white/[0.06] dark:shadow-[0_1px_2px_rgba(0,0,0,0.16)] ${risk.bg}`}
      role="status"
      aria-label={`Documenting for ${formatResidentLocation(unit, room, bed)}, ${RISK_LABELS[riskLevel]} risk`}
    >
      <span
        className="text-[15px] font-bold text-foreground"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {location}
      </span>
      <span
        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md ${risk.badgeBg} ${risk.badgeText}`}
      >
        {RISK_LABELS[riskLevel]}
      </span>
    </div>
  );
}
