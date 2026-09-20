'use client';

import { useTranslations } from 'next-intl';
import type { DailyCheckinEntry } from '@/lib/api';

/**
 * "Your Progress" — the week's check-ins, drawn from real entries only.
 *
 * Every number here is counted from `DailyCheckinEntry[]`. The reference
 * design also showed a "Calm practices" tile; nothing in the app records
 * practice completions, so that tile would have been a made-up number and
 * is replaced by the current streak, which is derivable. The y-axis is the
 * three severities the app actually stores rather than a 0–100% score, so
 * the chart can't imply a clinical measure the product doesn't compute.
 */

const SEVERITY_LEVEL: Record<DailyCheckinEntry['severity'], number> = {
  tough: 0,
  mild: 1,
  calm: 2,
};

export interface ProgressCardProps {
  entries: DailyCheckinEntry[];
  className?: string;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Parse a `YYYY-MM-DD` check-in date as a *local* calendar day.
 *  `new Date('2026-09-13')` is UTC midnight, which in any timezone west of
 *  UTC lands on the 12th locally and shifts the whole week back a column. */
function parseCheckDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** The seven days ending today, oldest first. */
function lastSevenDays(): Date[] {
  const today = startOfDay(new Date());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d;
  });
}

export function ProgressCard({ entries, className = '' }: ProgressCardProps) {
  const t = useTranslations('home');
  const days = lastSevenDays();

  // Most recent entry wins for a given day.
  const byDay = new Map<string, DailyCheckinEntry>();
  for (const e of entries) {
    const key = parseCheckDate(e.check_date).toDateString();
    const existing = byDay.get(key);
    if (!existing || new Date(e.created_at) > new Date(existing.created_at)) {
      byDay.set(key, e);
    }
  }

  const week = days.map((d) => ({
    date: d,
    label: d.toLocaleDateString(undefined, { weekday: 'short' }),
    entry: byDay.get(d.toDateString()) ?? null,
  }));

  const checkedIn = week.filter((d) => d.entry).length;
  const calmDays = week.filter((d) => d.entry?.severity === 'calm').length;

  // Streak = consecutive days with a check-in, counting back from today.
  let streak = 0;
  for (let i = week.length - 1; i >= 0; i--) {
    if (!week[i].entry) break;
    streak++;
  }

  // Plot geometry. Only days with an entry get a point; gaps stay gaps
  // rather than being interpolated into a number nobody reported.
  const W = 320;
  const H = 96;
  const padX = 6;
  const step = (W - padX * 2) / 6;
  const points = week
    .map((d, i) =>
      d.entry
        ? { x: padX + i * step, y: H - (SEVERITY_LEVEL[d.entry.severity] / 2) * H, i }
        : null,
    )
    .filter((p): p is { x: number; y: number; i: number } => p !== null);

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
  const areaPath =
    points.length > 1
      ? `${linePath} L${points[points.length - 1].x} ${H} L${points[0].x} ${H} Z`
      : '';

  return (
    <div className={`glass-panel p-5 sm:p-6 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('progress.title')}</h2>
          <p className="mt-0.5 text-sm text-foreground-muted">{t('progress.subtitle')}</p>
        </div>
        <span className="shrink-0 rounded-full border border-theme-soft px-3 py-1.5 text-xs font-medium text-foreground-muted">
          {t('progress.this_week')}
        </span>
      </div>

      {points.length === 0 ? (
        <p className="mt-6 text-sm text-foreground-muted">{t('progress.empty')}</p>
      ) : (
        <div className="mt-5 flex gap-3">
          <div
            aria-hidden="true"
            className="flex flex-col justify-between py-0.5 text-[11px] text-foreground-muted"
          >
            <span>{t('progress.level.calm')}</span>
            <span>{t('progress.level.mild')}</span>
            <span>{t('progress.level.tough')}</span>
          </div>
          <div className="min-w-0 flex-1">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="h-24 w-full"
              preserveAspectRatio="none"
              role="img"
              aria-label={t('progress.chart_label', { count: checkedIn })}
            >
              {[0, H / 2, H].map((y) => (
                <line
                  key={y}
                  x1="0"
                  y1={y}
                  x2={W}
                  y2={y}
                  stroke="var(--color-border-soft)"
                  strokeWidth="1"
                />
              ))}
              {areaPath && <path d={areaPath} fill="var(--color-accent-sky)" opacity="0.12" />}
              <path
                d={linePath}
                fill="none"
                stroke="var(--color-accent-sky)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {points.map((p) => (
                <circle
                  key={p.i}
                  cx={p.x}
                  cy={p.y}
                  r="3"
                  fill="var(--color-surface)"
                  stroke="var(--color-accent-sky)"
                  strokeWidth="2"
                />
              ))}
            </svg>
            <div className="mt-1.5 flex justify-between text-[11px] text-foreground-muted">
              {week.map((d) => (
                <span key={d.date.toDateString()}>{d.label}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-theme-soft pt-4">
        <Stat value={`${checkedIn} / 7`} label={t('progress.stat.checkins')} />
        <Stat value={String(calmDays)} label={t('progress.stat.calm_days')} />
        <Stat value={String(streak)} label={t('progress.stat.streak')} />
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-base font-semibold text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-foreground-muted">{label}</p>
    </div>
  );
}
