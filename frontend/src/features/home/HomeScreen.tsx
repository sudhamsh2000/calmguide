'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Link, useRouter } from '@/i18n/navigation';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { SignOutButton } from '@/components/ui/SignOutButton';
import { useProfile } from '@/context/ProfileContext';
import {
  getAccessCode,
  getActiveProfileAvatar,
  getPatientName,
  getProfiles,
  type ProfileAvatar as ProfileAvatarKind,
  noSessionRedirectPath,
} from '@/lib/storage';
import {
  getProfile,
  getConversations,
  getInsights,
  getPendingFeedback,
  submitFeedback,
  skipFeedback,
  getDailyCheckinStatus,
  getDailyCheckinHistory,
  submitDailyCheckin,
  getCarePatterns as getCarePatternData,
  getIncidents,
  getPatterns,
  getVerificationPending,
  verifyIncident,
} from '@/lib/api';
import type {
  InsightsPayload,
  PendingFeedback,
  CarePatternData,
  DailyCheckinEntry,
  IncidentResponse,
  PatternResponse,
  VerificationPending,
} from '@/lib/api';
import { PatientCard } from './PatientCard';
import { IncidentPatternCard } from './IncidentPatternCard';
import { ProfileSwitcher } from '@/components/ui/ProfileSwitcher';
import { VerificationCard } from '@/features/incidents/VerificationCard';
import { ConversationHistory } from './ConversationHistory';
import type { ConversationSummary } from './ConversationHistory';
import { PatternInsights } from './PatternInsights';
import { HomeFeedbackCard } from './HomeFeedbackCard';
import { DailyCheckinCard } from './DailyCheckinCard';
import { MomentCoachHero } from './MomentCoachHero';
import { ProgressCard } from './ProgressCard';
import { CarePatternCard } from './CarePatternCard';

export interface HomeScreenProps {
  className?: string;
}

export function HomeScreen({ className = '' }: HomeScreenProps) {
  const t = useTranslations('home');
  const tc = useTranslations('common');
  const router = useRouter();
  const { state, dispatch } = useProfile();
  const [patientName, setPatientName] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('');
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [insights, setInsights] = useState<InsightsPayload | null>(null);
  const [pendingFeedback, setPendingFeedback] = useState<PendingFeedback | null>(null);
  const [feedbackDismissed, setFeedbackDismissed] = useState(false);
  const [feedbackFading, setFeedbackFading] = useState(false);
  const [recentIncidents, setRecentIncidents] = useState<IncidentResponse[]>([]);
  const [incidentPatterns, setIncidentPatterns] = useState<PatternResponse | null>(null);
  const [hasMultipleProfiles, setHasMultipleProfiles] = useState(false);
  const [verificationPending, setVerificationPending] = useState<VerificationPending | null>(null);
  const [visitedCrisis, setVisitedCrisis] = useState(false);
  const [checkedInToday, setCheckedInToday] = useState(true); // default hidden until we know
  const [carePattern, setCarePattern] = useState<CarePatternData | null>(null);
  const [checkinEntries, setCheckinEntries] = useState<DailyCheckinEntry[]>([]);
  const [avatar, setAvatar] = useState<ProfileAvatarKind>('monogram');
  const showCheckin = !checkedInToday && !visitedCrisis;

  // Widens the app shell for this screen only; cleaned up on unmount so
  // every other route keeps the standard reading width.
  useEffect(() => {
    document.documentElement.setAttribute('data-dashboard', '');
    return () => document.documentElement.removeAttribute('data-dashboard');
  }, []);

  useEffect(() => {
    const visited = sessionStorage.getItem('calmguide_visited_coach');
    if (visited === 'true') setVisitedCrisis(true);
  }, []);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) setGreeting(t('greeting.morning'));
    else if (hour >= 12 && hour < 17) setGreeting(t('greeting.afternoon'));
    else setGreeting(t('greeting.evening'));

    const code = getAccessCode();
    const name = getPatientName();

    if (!code || !name) {
      router.push(noSessionRedirectPath());
      return;
    }

    setAccessCode(code);
    setPatientName(name);
    setHasMultipleProfiles(getProfiles().length > 1);
    setAvatar(getActiveProfileAvatar());

    // Fetch recent incidents
    getIncidents(code, { limit: 3 })
      .then((data) => setRecentIncidents(data.incidents))
      .catch(() => {});

    // Fetch incident patterns (available after 8+ incidents)
    getPatterns(code)
      .then((data) => {
        if (data) setIncidentPatterns(data);
      })
      .catch(() => {});

    // Fetch pending verification card (auto-extracted incidents awaiting review)
    getVerificationPending(code)
      .then((data) => {
        if (data) setVerificationPending(data);
      })
      .catch(() => {});

    // Fetch conversations (fire-and-forget, gracefully handle errors)
    getConversations(code)
      .then((data) => {
        const mapped: ConversationSummary[] = data.map((c) => ({
          id: c.session_id,
          title: c.title,
          timestamp: new Date(c.created_at),
        }));
        setConversations(mapped);
      })
      .catch(() => {
        // Silently ignore — just show empty state
      });

    // Fetch behavioral insights (available after ≥3 sessions)
    getInsights(code)
      .then((data) => {
        if (data) setInsights(data.insights);
      })
      .catch(() => {
        // Silently ignore — insights are non-critical
      });

    // Fetch pending feedback for home screen card
    getPendingFeedback(code)
      .then((data) => {
        if (data) setPendingFeedback(data);
      })
      .catch(() => {});

    getDailyCheckinStatus(code)
      .then((data) => setCheckedInToday(data.checked_in))
      .catch(() => {});

    getDailyCheckinHistory(code, 7)
      .then((data) => setCheckinEntries(data.entries ?? []))
      .catch(() => {});

    getCarePatternData(code)
      .then((data) => {
        if (data) setCarePattern(data);
      })
      .catch(() => {});

    if (!state.profile) {
      dispatch({ type: 'FETCH_START' });
      getProfile(code)
        .then((profile) => {
          dispatch({ type: 'FETCH_SUCCESS', payload: profile });
        })
        .catch((err) => {
          dispatch({
            type: 'FETCH_ERROR',
            payload: err instanceof Error ? err.message : 'Failed to load profile',
          });
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [dispatch, router, state.profile]);

  const handleFeedbackSubmit = useCallback(
    async (helpful: boolean, tags: string[], negativeReasons: string[]) => {
      if (!accessCode || !pendingFeedback) return;
      try {
        await submitFeedback(
          accessCode,
          pendingFeedback.conversation_id,
          helpful,
          tags,
          negativeReasons,
        );
        // Show thanks → fade out → remove
        setTimeout(() => setFeedbackFading(true), 3000);
        setTimeout(() => setPendingFeedback(null), 3500);
      } catch {
        // Silently fail — localStorage retry queue can be added later
      }
    },
    [accessCode, pendingFeedback],
  );

  const handleCheckin = useCallback(
    async (severity: 'calm' | 'mild' | 'tough', timeSlot?: string, tags?: string[]) => {
      if (!accessCode) return;
      try {
        await submitDailyCheckin(accessCode, severity, timeSlot, tags);
        setCheckedInToday(true);
      } catch {
        /* silent */
      }
    },
    [accessCode],
  );

  const handleFeedbackDismiss = useCallback(async () => {
    if (!accessCode || !pendingFeedback) return;
    setFeedbackDismissed(true);
    try {
      await skipFeedback(accessCode, pendingFeedback.conversation_id);
    } catch {
      // Silently ignore
    }
  }, [accessCode, pendingFeedback]);

  if (loading || !patientName || !accessCode) {
    return (
      <div className={`flex flex-col items-center justify-center gap-4 py-16 ${className}`}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-foreground-muted">{t('loading_profile')}</p>
      </div>
    );
  }

  const diseaseStage = state.profile?.disease_stage ?? 'unknown';
  const behaviorCount = state.profile?.behavioral_patterns?.length ?? 0;

  return (
    /* Desktop (lg+) splits into two columns per the design brief: the left
     * column keeps the primary "act now" experience (greeting, who we're
     * caring for, Moment Coach, quick actions, today's check-in) and the
     * right column carries supporting context (patterns, history, journey
     * links). Below lg it collapses to one column — and because sections
     * 1-7 already precede 8-11 in the source order, the mobile stacking
     * order is byte-for-byte what it was before this split. */
    <div
      className={`relative px-5 pt-5 pb-8 lg:grid lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start lg:gap-x-6 ${className}`}
    >
      {/* Decorative section glow (design/design.md §19) — the landing page's
       * soft-blob language extended in here, but static and low-opacity:
       * this is the primary "act now" screen, so nothing should compete
       * with the Moment Coach card or alert cards for attention. Confined
       * to its own inset-0/overflow-hidden layer so it never affects the
       * real content's layout or the ProfileSwitcher dropdown's ability to
       * escape this container. */}
      <div aria-hidden="true" className="decor-layer pointer-events-none absolute inset-0 -z-10">
        <div className="decor-blob decor-blob-aqua -top-16 -start-10 h-72 w-72" />
        <div className="decor-blob decor-blob-lavender top-[38%] -end-16 h-72 w-72" />
      </div>

      {/* The rail stays put while the long right-hand column scrolls past
       * it: who you're caring for, and the two things you might do next,
       * should not scroll away. `top-5` matches the section's own `pt-5`
       * so it keeps its breathing room instead of pinning flush to the
       * edge. */}
      <div className="flex flex-col gap-5 lg:sticky lg:top-5 lg:self-start">
        {/* Profile Switcher */}
        {hasMultipleProfiles && <ProfileSwitcher onSwitch={() => window.location.reload()} />}

        {/* 0. BRAND ROW — logo and theme control, per the dashboard design.
         * Desktop only: the mobile app shell already has its own header. */}
        <div className="hidden items-center justify-between lg:flex">
          <Image
            src="/brand/calmguide-logo-transparent.png"
            alt="CalmGuide"
            width={2172}
            height={724}
            priority
            className="brand-mark h-9 w-auto"
          />
          <div className="flex items-center gap-1">
            <ThemeToggle variant="pill" />
            <SignOutButton variant="icon" />
          </div>
        </div>

        {/* 1. GREETING — orients the user, confirms right profile */}
        <div>
          {greeting && <p className="text-sm text-foreground-muted">{greeting}</p>}
          <h1
            className="text-[26px] font-medium text-foreground leading-tight mt-0.5"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('hero')}
          </h1>
        </div>

        {/* 2. URGENT ALERTS — care pattern alert, shown only when needs attention */}
        {carePattern && carePattern.care_level === 'needs_attention' && (
          <CarePatternCard carePattern={carePattern} />
        )}

        {/* 3. PATIENT CARD — who we're caring for */}
        <PatientCard
          patientName={patientName}
          diseaseStage={diseaseStage}
          behaviorCount={behaviorCount}
          avatar={avatar}
        />

        {/* 5. NON-URGENT ALERTS — verification card, feedback (important but not blocking) */}
        {verificationPending && accessCode && (
          <VerificationCard
            accessCode={accessCode}
            pending={verificationPending}
            onDismiss={() => setVerificationPending(null)}
          />
        )}
        {pendingFeedback && !feedbackDismissed && !visitedCrisis && (
          <div
            className={`transition-opacity duration-300 ${
              feedbackFading ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <HomeFeedbackCard
              pending={pendingFeedback}
              onDismiss={handleFeedbackDismiss}
              onSubmit={handleFeedbackSubmit}
            />
          </div>
        )}

        {/* 6. QUICK ACTIONS — full-width rows in the left rail (dashboard design) */}
        <div className="flex flex-col gap-3">
          <Link href="/learn" className="block group">
            <div className="flex items-center gap-4 rounded-2xl border border-foreground/10 bg-surface px-4 py-4 text-start transition-colors duration-200 group-hover:border-primary/40 group-hover:bg-primary/3 group-focus-visible:outline-none group-focus-visible:ring-3 group-focus-visible:ring-primary group-focus-visible:ring-offset-2 active:scale-[0.97] cursor-pointer">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accentSky-soft text-accentSky">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {t('quick_actions.practice')}
                </p>
                <p className="text-xs text-foreground-muted mt-0.5">
                  {t('quick_actions.practice_subtitle')}
                </p>
              </div>
            </div>
          </Link>
          <Link href="/check-in" className="block group">
            <div className="flex items-center gap-4 rounded-2xl border border-foreground/10 bg-surface px-4 py-4 text-start transition-colors duration-200 group-hover:border-primary/40 group-hover:bg-primary/3 group-focus-visible:outline-none group-focus-visible:ring-3 group-focus-visible:ring-primary group-focus-visible:ring-offset-2 active:scale-[0.97] cursor-pointer">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accentSky-soft text-accentSky">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {t('quick_actions.check_in')}
                </p>
                <p className="text-xs text-foreground-muted mt-0.5">
                  {t('quick_actions.check_in_subtitle')}
                </p>
              </div>
            </div>
          </Link>
        </div>

      </div>

      {/* ---- Main column (lg+): the dashboard proper ---- */}
      <div className="flex flex-col gap-5 mt-5 lg:mt-0">
        {/* 4. PRIMARY CTA — Moment Coach. Full width of this column, the only
         * dark surface and the only motion on the screen. */}
        <MomentCoachHero />

        {/* 5. TODAY — how the day went, beside the week it rolls up into.
         * Check-in only renders while it's still actionable; progress is
         * always there, so the pair collapses to one card once logged. */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {showCheckin && <DailyCheckinCard onSubmit={handleCheckin} />}
          <ProgressCard entries={checkinEntries} className={showCheckin ? '' : 'xl:col-span-2'} />
        </div>

        {/* ---- Supporting context: patterns, incidents, history, journey.
         *
         * These were hidden at lg+ for the single-screen dashboard, which
         * was a mistake — the bottom nav is *also* `lg:hidden`, so hiding
         * them left /incidents with no route at all on desktop. The
         * dashboard scrolls again, and these pair up into two columns from
         * xl where the main column is wide enough (~900px) that a single
         * stack of full-width cards would just look stretched. ---- */}
        <div className="flex flex-col gap-5 xl:grid xl:grid-cols-2 xl:items-start">
        {/* 8. PATTERN INSIGHTS — behavioral trends and incident patterns */}
        {insights && <PatternInsights insights={insights} />}
        {incidentPatterns && <IncidentPatternCard patterns={incidentPatterns} />}

        {/* 9. LOG INCIDENT + RECENT INCIDENTS — secondary action + history */}
        <Link href="/incidents/new" className="block group">
          <div className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-surface px-4 py-4 transition-colors duration-200 group-hover:border-primary/40 group-hover:bg-primary/3 group-focus-visible:outline-none group-focus-visible:ring-3 group-focus-visible:ring-primary group-focus-visible:ring-offset-2 active:scale-[0.98] cursor-pointer">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accentSky-soft text-accentSky">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <span className="text-base font-semibold text-foreground">
              {t('log_incident', { defaultMessage: 'Log an incident' })}
            </span>
          </div>
        </Link>

        {recentIncidents.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">Recent incidents</p>
              <Link
                href="/incidents"
                className="focus-ring inline-flex min-h-tap items-center rounded px-2 text-sm font-medium text-accentSky hover:underline"
              >
                See all
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              {recentIncidents.map((inc) => (
                <Link key={inc.id} href={`/incidents/${inc.id}`} className="block group">
                  <div className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-surface px-4 py-3 min-h-[44px] transition-colors duration-200 group-hover:border-primary/40 group-hover:bg-primary/3 group-focus-visible:outline-none group-focus-visible:ring-3 group-focus-visible:ring-primary group-focus-visible:ring-offset-2 cursor-pointer">
                    <span className="text-sm text-foreground-muted">
                      {new Date(inc.incident_time).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="text-sm text-foreground truncate flex-1">
                      {inc.behavior_description}
                    </span>
                    {inc.severity && (
                      <span className="text-xs text-foreground-muted capitalize">
                        {inc.severity}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 10. RECENT CONVERSATIONS — history, lowest priority */}
        <ConversationHistory conversations={conversations} />

        {/* 11. JOURNEY NAVIGATION — navigation links, bottom of page */}
        <div className="rounded-2xl border border-foreground/10 bg-surface p-4">
          <p className="text-sm font-semibold text-foreground mb-3">{tc('journey_nav.heading')}</p>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/journey/noticing"
              className="rounded-2xl border border-foreground/10 px-3 py-3 min-h-[44px] flex items-center text-sm text-foreground transition-colors duration-200 hover:border-primary/40 hover:bg-primary/3 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {tc('journey_nav.noticing')}
            </Link>
            <Link
              href="/journey/diagnosis"
              className="rounded-2xl border border-foreground/10 px-3 py-3 min-h-[44px] flex items-center text-sm text-foreground transition-colors duration-200 hover:border-primary/40 hover:bg-primary/3 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {tc('journey_nav.diagnosis')}
            </Link>
            <Link
              href="/journey/hospice"
              className="rounded-2xl border border-foreground/10 px-3 py-3 min-h-[44px] flex items-center text-sm text-foreground transition-colors duration-200 hover:border-primary/40 hover:bg-primary/3 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {tc('journey_nav.hospice')}
            </Link>
            <Link
              href="/journey/bereavement"
              className="rounded-2xl border border-foreground/10 px-3 py-3 min-h-[44px] flex items-center text-sm text-foreground transition-colors duration-200 hover:border-primary/40 hover:bg-primary/3 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {tc('journey_nav.bereavement')}
            </Link>
          </div>
        </div>

        <div className="mt-2 text-center">
          <Link
            href="/impact"
            className="focus-ring inline-flex min-h-tap items-center rounded px-2 text-sm text-foreground-muted underline underline-offset-2 hover:text-foreground"
          >
            {t('impact_link')}
          </Link>
        </div>

        </div>

        {state.error && (
          <div className="rounded-xl bg-error/10 border border-error/30 p-4" role="alert">
            <p className="text-sm text-error">{state.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
