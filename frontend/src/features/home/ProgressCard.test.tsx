import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressCard } from './ProgressCard';
import type { DailyCheckinEntry } from '@/lib/api';

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string, values?: Record<string, string | number>) => {
      const messages: Record<string, string> = {
        'progress.title': 'Your Progress',
        'progress.subtitle': 'Stay consistent, see growth.',
        'progress.this_week': 'This week',
        'progress.empty': 'No check-ins yet this week.',
        'progress.level.calm': 'Calm',
        'progress.level.mild': 'Mild',
        'progress.level.tough': 'Tough',
        'progress.chart_label': `${values?.count} check-ins this week`,
        'progress.stat.checkins': 'Check-ins',
        'progress.stat.calm_days': 'Calm days',
        'progress.stat.streak': 'Day streak',
      };
      return messages[key] ?? key;
    };
    return t;
  },
}));

/** A check-in on the local calendar day `daysAgo` days before today. */
function entry(daysAgo: number, severity: DailyCheckinEntry['severity']): DailyCheckinEntry {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
  return {
    id: `id-${daysAgo}`,
    check_date: iso,
    severity,
    time_slot: null,
    tags: [],
    created_at: `${iso}T12:00:00`,
  } as DailyCheckinEntry;
}

describe('ProgressCard', () => {
  it('shows the empty state when there are no entries', () => {
    render(<ProgressCard entries={[]} />);
    expect(screen.getByText('No check-ins yet this week.')).toBeInTheDocument();
  });

  it('counts check-ins, calm days and the streak from real entries', () => {
    render(
      <ProgressCard
        entries={[entry(2, 'tough'), entry(1, 'calm'), entry(0, 'calm')]}
      />,
    );
    expect(screen.getByText('3 / 7')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // calm days
    expect(screen.getByText('3')).toBeInTheDocument(); // streak: three consecutive days
  });

  describe.each(['UTC', 'America/Los_Angeles', 'Asia/Kolkata', 'Pacific/Auckland'])(
    'in %s',
    (timeZone) => {
      beforeEach(() => {
        // `new Date('2026-09-13')` is UTC midnight. Keying entries by that
        // Date shifted every check-in a day earlier west of UTC, dropping
        // today off the chart entirely — the regression this guards.
        vi.stubEnv('TZ', timeZone);
        process.env.TZ = timeZone;
      });
      afterEach(() => {
        vi.unstubAllEnvs();
      });

      it('places a full week of entries on all seven days', () => {
        const entries = [6, 5, 4, 3, 2, 1, 0].map((n) => entry(n, 'calm'));
        render(<ProgressCard entries={entries} />);
        expect(screen.getByText('7 / 7')).toBeInTheDocument();
      });
    },
  );
});
