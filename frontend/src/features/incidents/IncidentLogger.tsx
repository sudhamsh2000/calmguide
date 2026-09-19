'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { getAccessCode } from '@/lib/storage';
import { createIncident, updateIncident } from '@/lib/api';
import type {
  BehaviorCategory,
  SeverityLevel,
  DurationCategory,
  AntecedentCategory,
  InterventionOutcome,
  IncidentCreate,
} from '@/lib/api';

export interface IncidentLoggerProps {
  className?: string;
  onComplete?: () => void;
  profileId?: string;
}

const BEHAVIOR_CATEGORIES: BehaviorCategory[] = [
  'aggression_anger',
  'confusion_disorientation',
  'wandering_exit_seeking',
  'refusing_care',
  'sleep_problems',
  'hallucinations',
  'repetitive_behavior',
  'other',
];

/* Line icons in soft-tinted circles, matching the supplied Incident Log
 * reference. Previously these were single-letter placeholders ("A", "?",
 * "W"...) which read as codes rather than categories — the icons carry the
 * meaning faster under stress, which is the whole point of this screen. Each
 * is drawn on the same 24px grid at the same stroke weight as the rest of the
 * app's iconography, so nothing here is pulled from an external icon set. */
const CATEGORY_ICONS: Record<BehaviorCategory, React.ReactNode> = {
  // Distressed face
  aggression_anger: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 15.5c1-1 5-1 7 0M8.5 9.5l1.5 1M15.5 9.5L14 10.5" />
    </>
  ),
  // Question mark — disorientation
  confusion_disorientation: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.6v.3" />
      <path d="M12 17.2h.01" />
    </>
  ),
  // Walking figure — wandering / exit-seeking
  wandering_exit_seeking: (
    <>
      <circle cx="13" cy="4.5" r="1.6" />
      <path d="M11 21l1.5-5.5-2.5-2 1-4.5 3 2 2.5 1" />
      <path d="M10 12.5L7.5 14 6 19" />
    </>
  ),
  // Open palm — refusing care
  refusing_care: (
    <>
      <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M12 10.5V4.8a1.5 1.5 0 0 1 3 0V11" />
      <path d="M15 11V7a1.5 1.5 0 0 1 3 0v6.5a7 7 0 0 1-7 7h-.5a6 6 0 0 1-4.4-2L4 16.2a1.6 1.6 0 0 1 2.4-2.1L9 16.5" />
    </>
  ),
  // Moon — sleep problems
  sleep_problems: (
    <>
      <path d="M20 14.5A8.2 8.2 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" />
    </>
  ),
  // Ear — seeing / hearing things
  hallucinations: (
    <>
      <path d="M7 8.5a5 5 0 0 1 10 0c0 2.6-2 3.5-3 5-.6.9-.4 2.4-1.8 2.9" />
      <path d="M10.2 9a1.9 1.9 0 0 1 3.7.4" />
      <path d="M9 19.5c.8.7 1.8 1 2.8.9" />
    </>
  ),
  // Circular arrow — repetitive behavior
  repetitive_behavior: (
    <>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v4.5h-4.5" />
    </>
  ),
  // Ellipsis — other
  other: (
    <>
      <circle cx="6" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="18" cy="12" r="1.4" />
    </>
  ),
};

/* Category accent colours. Kept close to the previous set (so existing
 * incident history stays visually recognisable) but pulled toward the
 * CalmGuide palette. These are intentionally per-category rather than
 * tokenised: they encode *which behaviour*, not a semantic app state, and a
 * caregiver learns them by hue. */
const CATEGORY_COLORS: Record<BehaviorCategory, string> = {
  aggression_anger: '#B84C36',
  confusion_disorientation: '#6F7FD8',
  wandering_exit_seeking: '#2B7A78',
  refusing_care: '#C1762F',
  sleep_problems: '#5B6ABF',
  hallucinations: '#7B5EA7',
  repetitive_behavior: '#3AAFA9',
  other: '#6B7280',
};

function CategoryIcon({ category }: { category: BehaviorCategory }) {
  return (
    <span
      className="flex h-11 w-11 items-center justify-center rounded-full"
      style={{
        backgroundColor: CATEGORY_COLORS[category] + '1F',
        color: CATEGORY_COLORS[category],
      }}
      aria-hidden="true"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {CATEGORY_ICONS[category]}
      </svg>
    </span>
  );
}

const SEVERITY_LEVELS: SeverityLevel[] = ['mild', 'moderate', 'severe'];
const DURATION_CATEGORIES: DurationCategory[] = ['seconds', 'minutes', 'about_an_hour', 'longer'];

const ANTECEDENT_CATEGORIES: AntecedentCategory[] = [
  'task_demand',
  'transition',
  'environmental',
  'social',
  'physical_state',
  'unknown',
];

const INTERVENTION_OPTIONS = [
  'music',
  'redirect',
  'quiet_space',
  'warm_drink',
  'wait_it_out',
  'other',
] as const;

const OUTCOME_OPTIONS: InterventionOutcome[] = [
  'resolved',
  'partially_resolved',
  'unresolved',
  'escalated',
];

type TimeChoice = 'just_now' | 'earlier_today' | 'yesterday';

function resolveIncidentTime(choice: TimeChoice, hour?: number): string {
  const now = new Date();
  if (choice === 'just_now') {
    return now.toISOString();
  }
  if (choice === 'earlier_today') {
    const d = new Date(now);
    d.setHours(hour ?? 12, 0, 0, 0);
    return d.toISOString();
  }
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  d.setHours(hour ?? 12, 0, 0, 0);
  return d.toISOString();
}

const INTERVENTION_TO_DESCRIPTION: Record<string, string> = {
  music: 'Played music',
  redirect: 'Redirected attention',
  quiet_space: 'Moved to quiet space',
  warm_drink: 'Offered warm drink',
  wait_it_out: 'Waited it out',
  other: 'Other intervention',
};

export function IncidentLogger({ className = '', onComplete, profileId }: IncidentLoggerProps) {
  const t = useTranslations('incidents');
  const router = useRouter();

  const [level, setLevel] = useState(1);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [showMorePrompt, setShowMorePrompt] = useState(false);

  // Level 1
  const [category, setCategory] = useState<BehaviorCategory | null>(null);
  const [timeChoice, setTimeChoice] = useState<TimeChoice | null>(null);
  const [timeHour, setTimeHour] = useState<number>(12);

  // Level 2
  const [severity, setSeverity] = useState<SeverityLevel | null>(null);
  const [duration, setDuration] = useState<DurationCategory | null>(null);

  // Level 3
  const [antecedent, setAntecedent] = useState<AntecedentCategory | null>(null);
  const [intervention, setIntervention] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<InterventionOutcome | null>(null);

  // Level 4
  const [notes, setNotes] = useState('');

  const accessCode = useMemo(() => (profileId ? null : getAccessCode()), [profileId]);
  const savingRef = useRef(false);

  const buildIncidentData = useCallback((): IncidentCreate | null => {
    if (!category || !timeChoice) return null;
    return {
      behavior_category: category,
      behavior_description: t(`logger.category.${category}`).replace(/\n/g, ' '),
      incident_time: resolveIncidentTime(timeChoice, timeHour),
      source: 'manual',
      severity: severity ?? undefined,
      duration_category: duration ?? undefined,
      antecedent_category: antecedent ?? undefined,
      antecedent_description: antecedent ? t(`logger.antecedent.${antecedent}`) : undefined,
      intervention_description: intervention
        ? (INTERVENTION_TO_DESCRIPTION[intervention] ?? intervention)
        : undefined,
      intervention_outcome: outcome ?? undefined,
    };
  }, [category, timeChoice, timeHour, severity, duration, antecedent, intervention, outcome, t]);

  const savedIdRef = useRef<string | null>(null);

  const saveIncident = useCallback(async () => {
    if ((!accessCode && !profileId) || savingRef.current) return;
    const data = buildIncidentData();
    if (!data) return;

    if (notes.trim()) {
      data.behavior_description = `${data.behavior_description}. ${notes.trim()}`;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      if (savedIdRef.current) {
        if (!profileId) {
          await updateIncident(accessCode!, savedIdRef.current, data);
        }
      } else {
        let result;
        if (profileId) {
          const { createIncidentByProfile } = await import('@/lib/facility-api');
          result = await createIncidentByProfile(profileId, data);
        } else {
          result = await createIncident(accessCode!, data);
        }
        savedIdRef.current = result.id;
        setSavedId(result.id);
      }
    } catch {
      // Silent fail — auto-save UX
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [accessCode, profileId, buildIncidentData, notes]);

  const saveIncidentRef = useRef(saveIncident);
  saveIncidentRef.current = saveIncident;

  // Auto-save after Level 1
  useEffect(() => {
    if (category && timeChoice && !savedId && !savingRef.current) {
      saveIncidentRef.current();
    }
  }, [category, timeChoice, savedId]);

  // Auto-save updates at higher levels (only when user picks a new option)
  useEffect(() => {
    if (!savedId) return;
    if (!severity && !duration && !antecedent && !intervention && !outcome) return;
    const timer = setTimeout(() => {
      if (!savingRef.current) saveIncidentRef.current();
    }, 500);
    return () => clearTimeout(timer);
  }, [savedId, severity, duration, antecedent, intervention, outcome]);

  if (savedId && showMorePrompt && level === 1) {
    return (
      <div className={`flex flex-col gap-6 pt-4 ${className}`}>
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-success-bg text-success-text">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#3A7D5C"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p
            className="text-xl font-medium text-foreground"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('logger.saved')}
          </p>
          <p className="mt-2 text-base text-foreground-muted">{t('logger.more_details_prompt')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="primary"
            size="lg"
            className="flex-1 min-w-[140px]"
            onClick={() => {
              setShowMorePrompt(false);
              setLevel(2);
            }}
          >
            {t('logger.yes_add_details')}
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="flex-1 min-w-[140px]"
            onClick={() => {
              if (onComplete) onComplete();
              else router.push('/home');
            }}
          >
            {t('logger.no_thanks')}
          </Button>
        </div>
      </div>
    );
  }

  if (level === 1) {
    return (
      <div className={`flex flex-col gap-6 ${className}`}>
        <p className="text-base text-foreground-muted leading-relaxed">
          {!category ? t('logger.what_happened') : t('logger.when')}
        </p>

        {/* Step 1: Category */}
        {!category && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {BEHAVIOR_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                aria-label={t(`logger.category.${cat}`).replace(/\n/g, ' ')}
                onClick={() => setCategory(cat)}
                className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-border dark:border-theme-soft bg-surface px-3 py-5 min-h-[100px] text-center transition-all hover:border-primary/20 hover:bg-primary/[0.025] dark:hover:border-primary/25 dark:hover:bg-primary/[0.05] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_0_0_1px_rgba(26,35,50,0.14)] focus-ring cursor-pointer"
              >
                <CategoryIcon category={cat} />
                <span className="text-sm font-medium text-foreground leading-tight">
                  {t(`logger.category.${cat}`).replace(/\n/g, ' ')}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Time */}
        {category && !timeChoice && (
          <div className="grid grid-cols-1 gap-3">
            {(['just_now', 'earlier_today', 'yesterday'] as TimeChoice[]).map((tc) => (
              <button
                key={tc}
                type="button"
                onClick={() => {
                  setTimeChoice(tc);
                  setShowMorePrompt(true);
                }}
                className="rounded-full border border-border dark:border-theme-soft bg-surface px-4 py-4 min-h-[48px] text-left text-base font-medium text-foreground transition-all hover:border-primary/20 hover:bg-primary/[0.025] dark:hover:border-primary/25 dark:hover:bg-primary/[0.05] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_0_0_1px_rgba(26,35,50,0.14)] focus-ring cursor-pointer"
              >
                {t(`logger.${tc}`)}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (level === 2) {
    return (
      <div className={`flex flex-col gap-6 ${className}`}>
        <div className="flex flex-col gap-4">
          <p className="text-base text-foreground-muted leading-relaxed">{t('logger.how_bad')}</p>
          <div className="grid grid-cols-3 gap-3">
            {SEVERITY_LEVELS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeverity(s)}
                className={[
                  'rounded-xl border py-3 px-2 min-h-[48px] text-center text-base font-medium transition-all focus-ring cursor-pointer',
                  severity === s
                    ? 'border-primary/60 bg-primary/[0.07] text-primary dark:border-primary/45 dark:bg-primary/[0.11] dark:text-primary-light shadow-[inset_0_0_0_1px_rgba(58,175,169,0.22)]'
                    : 'border-border dark:border-theme-soft bg-surface text-foreground hover:border-primary/20 hover:bg-primary/[0.025] dark:hover:border-primary/25 dark:hover:bg-primary/[0.05]',
                ].join(' ')}
              >
                {t(`logger.severity.${s}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <p className="text-base text-foreground-muted leading-relaxed">{t('logger.how_long')}</p>
          <div className="grid grid-cols-2 gap-3">
            {DURATION_CATEGORIES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                className={[
                  'rounded-xl border py-3 px-2 min-h-[48px] text-center text-base font-medium transition-all focus-ring cursor-pointer',
                  duration === d
                    ? 'border-primary/60 bg-primary/[0.07] text-primary dark:border-primary/45 dark:bg-primary/[0.11] dark:text-primary-light shadow-[inset_0_0_0_1px_rgba(58,175,169,0.22)]'
                    : 'border-border dark:border-theme-soft bg-surface text-foreground hover:border-primary/20 hover:bg-primary/[0.025] dark:hover:border-primary/25 dark:hover:bg-primary/[0.05]',
                ].join(' ')}
              >
                {t(`logger.duration.${d}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-2">
          <Button
            variant="primary"
            size="lg"
            className="flex-1 min-w-[140px]"
            onClick={() => setLevel(3)}
          >
            {t('logger.save')}
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="flex-1 min-w-[140px]"
            onClick={() => setLevel(3)}
          >
            {t('logger.skip')}
          </Button>
        </div>
      </div>
    );
  }

  if (level === 3) {
    return (
      <div className={`flex flex-col gap-6 ${className}`}>
        <div className="flex flex-col gap-4">
          <p className="text-base text-foreground-muted leading-relaxed">
            {t('logger.what_before')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {ANTECEDENT_CATEGORIES.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAntecedent(a)}
                className={[
                  'rounded-xl border py-3 px-2 min-h-[48px] text-center text-sm font-medium transition-all focus-ring cursor-pointer',
                  antecedent === a
                    ? 'border-primary/60 bg-primary/[0.07] text-primary dark:border-primary/45 dark:bg-primary/[0.11] dark:text-primary-light shadow-[inset_0_0_0_1px_rgba(58,175,169,0.22)]'
                    : 'border-border dark:border-theme-soft bg-surface text-foreground hover:border-primary/20 hover:bg-primary/[0.025] dark:hover:border-primary/25 dark:hover:bg-primary/[0.05]',
                ].join(' ')}
              >
                {t(`logger.antecedent.${a}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <p className="text-base text-foreground-muted leading-relaxed">
            {t('logger.what_tried')}
          </p>
          <div className="grid grid-cols-3 gap-3">
            {INTERVENTION_OPTIONS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIntervention(i)}
                className={[
                  'rounded-xl border py-3 px-2 min-h-[48px] text-center text-sm font-medium transition-all focus-ring cursor-pointer',
                  intervention === i
                    ? 'border-primary/60 bg-primary/[0.07] text-primary dark:border-primary/45 dark:bg-primary/[0.11] dark:text-primary-light shadow-[inset_0_0_0_1px_rgba(58,175,169,0.22)]'
                    : 'border-border dark:border-theme-soft bg-surface text-foreground hover:border-primary/20 hover:bg-primary/[0.025] dark:hover:border-primary/25 dark:hover:bg-primary/[0.05]',
                ].join(' ')}
              >
                {t(`logger.intervention.${i}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <p className="text-base text-foreground-muted leading-relaxed">
            {t('logger.did_it_help')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {OUTCOME_OPTIONS.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOutcome(o)}
                className={[
                  'rounded-xl border py-3 px-2 min-h-[48px] text-center text-sm font-medium transition-all focus-ring cursor-pointer',
                  outcome === o
                    ? 'border-primary/60 bg-primary/[0.07] text-primary dark:border-primary/45 dark:bg-primary/[0.11] dark:text-primary-light shadow-[inset_0_0_0_1px_rgba(58,175,169,0.22)]'
                    : 'border-border dark:border-theme-soft bg-surface text-foreground hover:border-primary/20 hover:bg-primary/[0.025] dark:hover:border-primary/25 dark:hover:bg-primary/[0.05]',
                ].join(' ')}
              >
                {t(`logger.outcome.${o}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-2">
          <Button
            variant="primary"
            size="lg"
            className="flex-1 min-w-[140px]"
            onClick={() => setLevel(4)}
          >
            {t('logger.save')}
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="flex-1 min-w-[140px]"
            onClick={() => setLevel(4)}
          >
            {t('logger.skip')}
          </Button>
        </div>
      </div>
    );
  }

  // Level 4 — free text
  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      <p className="text-base text-foreground-muted leading-relaxed">{t('logger.anything_else')}</p>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        className="field-shell w-full resize-none px-4 py-3 text-base"
        placeholder=""
      />

      <Button
        variant="primary"
        size="lg"
        loading={saving}
        onClick={async () => {
          await saveIncident();
          if (onComplete) onComplete();
          else router.push('/home');
        }}
      >
        {t('logger.done')}
      </Button>
    </div>
  );
}
