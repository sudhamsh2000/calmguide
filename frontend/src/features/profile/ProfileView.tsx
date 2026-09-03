'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Link, useRouter, usePathname } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useProfile } from '@/context/ProfileContext';
import {
  getPatientName,
  getAccessCode,
  getAutoSpeakReplies,
  setAutoSpeakReplies,
} from '@/lib/storage';
import { getProfile } from '@/lib/api';
import { BackButton } from '@/components/ui/BackButton';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Switch } from '@/components/ui/Switch';
import { SignOutButton } from '@/components/ui/SignOutButton';
import { SUPPORTED_LOCALES, LOCALE_NAMES, type SupportedLocale } from '@/lib/locale';

export interface ProfileViewProps {
  className?: string;
}

const avatarColors: Record<string, string> = {
  early: 'bg-success/20 text-success',
  middle: 'bg-[#F5E0D4] text-[#C4724E]',
  late: 'bg-[#E2E8F0] text-[#475569]',
};

export function ProfileView({ className = '' }: ProfileViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const { state, dispatch } = useProfile();
  const [patientName, setPatientNameState] = useState<string | null>(null);
  const [accessCode, setAccessCodeState] = useState<string | null>(null);
  // Read from localStorage only after mount (SSR has no storage to read),
  // so this starts false and is corrected on the client immediately after —
  // same pattern the rest of this component already uses for patientName.
  const [autoSpeak, setAutoSpeakState] = useState(false);
  useEffect(() => {
    setAutoSpeakState(getAutoSpeakReplies());
  }, []);
  const handleAutoSpeakChange = (checked: boolean) => {
    setAutoSpeakState(checked);
    setAutoSpeakReplies(checked);
  };
  const [langOpen, setLangOpen] = useState(false);
  const langMenuId = useId();
  const langButtonRef = useRef<HTMLButtonElement>(null);
  const langOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const stageLabels: Record<string, string> = {
    early: t('view.early_stage'),
    middle: t('view.middle_stage'),
    late: t('view.late_stage'),
  };

  const translateProfileOption = (
    group: 'behavioral' | 'calming' | 'safety',
    value: string,
  ): string => {
    const key = `options.${group}.${value}`;
    return t.has(key) ? t(key) : value;
  };

  useEffect(() => {
    const code = getAccessCode();
    const name = getPatientName();

    if (!code || !name) {
      router.push('/profile/setup');
      return;
    }

    setPatientNameState(name);
    setAccessCodeState(code);

    if (!state.profile && !state.loading) {
      dispatch({ type: 'FETCH_START' });
      getProfile(code)
        .then((profile) => dispatch({ type: 'FETCH_SUCCESS', payload: profile }))
        .catch((err) => dispatch({ type: 'FETCH_ERROR', payload: err.message }));
    }
  }, [router, state.profile, state.loading, dispatch]);

  if (!patientName || !accessCode || state.loading || !state.profile) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const profile = state.profile;
  const diseaseStage = profile?.disease_stage ?? 'middle';
  const avatarStyle = avatarColors[diseaseStage] ?? 'bg-foreground/10 text-foreground';
  const initial = patientName.charAt(0).toUpperCase();

  const formattedCode =
    accessCode.length === 8 ? `${accessCode.slice(0, 4)}  ·  ${accessCode.slice(4)}` : accessCode;

  const handleLanguageChange = (newLocale: SupportedLocale) => {
    setLangOpen(false);
    router.replace(pathname, { locale: newLocale });
  };

  const focusLanguageOption = (index: number) => {
    langOptionRefs.current[index]?.focus();
  };

  const openLanguageMenu = (focusIndex = 0) => {
    setLangOpen(true);
    requestAnimationFrame(() => {
      focusLanguageOption(focusIndex);
    });
  };

  return (
    <div className={`flex flex-col gap-0 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 py-3">
        <BackButton href="/home" label={tc('nav.back_to_home')} />
        <h1
          className="text-xl font-medium text-foreground"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('view.title')}
        </h1>
      </div>

      {/* Name Card */}
      <div className="mt-3 flex items-center gap-4 rounded-2xl border border-foreground/10 bg-surface px-4 py-4">
        <div
          className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-xl font-bold ${avatarStyle}`}
          aria-hidden="true"
        >
          {initial}
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">{patientName}</p>
          <p className="text-[13px] text-foreground-muted mt-0.5">{t('view.name_hint')}</p>
        </div>
      </div>

      {/* Dementia Stage */}
      <div className="card-shell mt-5 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-2">
          {t('view.dementia_stage')}
        </p>
        <p className="text-base font-medium text-foreground">
          {stageLabels[diseaseStage] ?? diseaseStage}
        </p>
      </div>

      {/* Behavioral Patterns */}
      <div className="card-shell mt-4 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-3">
          {t('view.behavioral_patterns')}
        </p>
        <div className="flex flex-wrap gap-2">
          {(profile?.behavioral_patterns ?? []).length > 0 ? (
            (profile?.behavioral_patterns ?? []).map((pattern) => (
              <span
                key={pattern}
                className="inline-flex items-center px-3.5 py-1.5 rounded-full text-sm font-medium bg-primary/10 text-primary"
              >
                {translateProfileOption('behavioral', pattern)}
              </span>
            ))
          ) : (
            <p className="text-sm text-foreground-muted">{t('view.none_recorded')}</p>
          )}
        </div>
      </div>

      {/* Calming Strategies — the reference's "What Works Best" card. Rendered
       * as teal chips rather than a comma-joined sentence so each strategy is
       * individually scannable, matching how the reference presents them. */}
      <div className="card-shell mt-4 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-3">
          {t('view.calming_strategies')}
        </p>
        <div className="flex flex-wrap gap-2">
          {(profile?.calming_strategies ?? []).length > 0 ? (
            (profile?.calming_strategies ?? []).map((s) => (
              <span
                key={s}
                className="inline-flex items-center rounded-full bg-success-bg px-3.5 py-1.5 text-sm font-medium text-success-text"
              >
                {translateProfileOption('calming', s)}
              </span>
            ))
          ) : (
            <p className="text-sm text-foreground-muted">{t('view.none_recorded')}</p>
          )}
        </div>
      </div>

      {/* Safety Concerns — the reference's "What to Avoid" card, in the app's
       * safety-coral family so it reads as caution without alarming. */}
      <div className="card-shell mt-4 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-3">
          {t('view.safety_concerns')}
        </p>
        <div className="flex flex-wrap gap-2">
          {(profile?.safety_concerns ?? []).length > 0 ? (
            (profile?.safety_concerns ?? []).map((s) => (
              <span
                key={s}
                className="inline-flex items-center rounded-full bg-error-bg px-3.5 py-1.5 text-sm font-medium text-error"
              >
                {translateProfileOption('safety', s)}
              </span>
            ))
          ) : (
            <p className="text-sm text-foreground-muted">{t('view.none_recorded')}</p>
          )}
        </div>
      </div>

      {/* Access Code Card */}
      <div className="mt-6 rounded-2xl bg-foreground/[0.04] dark:bg-foreground/[0.06] px-5 py-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-foreground-muted mb-3">
          {t('view.access_code')}
        </p>
        <p className="text-2xl font-mono font-bold tracking-[0.15em] text-primary-dark dark:text-primary-light">
          {formattedCode}
        </p>
        <p className="mt-3 text-[13px] text-foreground-muted leading-relaxed">
          {t('view.access_code_hint')}
        </p>
      </div>

      {/* Edit Profile Button */}
      <Link
        href="/profile/edit"
        className="mt-5 flex min-h-tap items-center justify-center rounded-2xl border border-border dark:border-[#31445f] bg-surface px-6 py-3.5 text-base font-semibold text-foreground transition-all hover:border-primary/20 hover:bg-primary/[0.025] hover:text-primary dark:hover:border-primary/25 dark:hover:bg-primary/[0.05] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_0_0_1px_rgba(26,35,50,0.14)] focus-ring"
      >
        {t('actions.edit')}
      </Link>

      {/* Voice Section — first settings section, per product decision that
          auto-read is a caregiver-visibility feature worth surfacing before
          appearance/language. */}
      <div className="mt-8 pb-4 border-b border-foreground/10">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-4">
          {t('voice.label')}
        </p>
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="text-base text-foreground">{t('voice.auto_speak_replies')}</span>
            <p className="mt-1 text-sm text-foreground-muted leading-relaxed">
              {t('voice.auto_speak_replies_hint')}
            </p>
          </div>
          <Switch
            checked={autoSpeak}
            onChange={handleAutoSpeakChange}
            label={t('voice.auto_speak_replies')}
          />
        </div>
      </div>

      {/* Settings Section */}
      <div className="mt-5 pb-4 border-b border-foreground/10">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-4">
          {t('appearance')}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-base text-foreground">{t('appearance')}</span>
          <ThemeToggle />
        </div>
      </div>

      {/* Language Selector */}
      <div className="mt-5 pb-4 border-b border-foreground/10">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-4">
          {tc('language.label')}
        </p>
        <button
          ref={langButtonRef}
          type="button"
          onClick={() => setLangOpen(!langOpen)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              openLanguageMenu(0);
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              openLanguageMenu(SUPPORTED_LOCALES.length - 1);
            }
          }}
          aria-haspopup="menu"
          aria-expanded={langOpen}
          aria-controls={langMenuId}
          className="w-full flex items-center justify-between rounded-xl border border-border dark:border-[#31445f] bg-surface px-4 py-3 min-h-[48px] text-base text-foreground transition-all hover:border-primary/20 hover:bg-primary/[0.025] dark:hover:border-primary/25 dark:hover:bg-primary/[0.05] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_0_0_1px_rgba(26,35,50,0.14)] focus-ring cursor-pointer"
        >
          <span dir="auto">{LOCALE_NAMES[locale as SupportedLocale] ?? locale}</span>
          <span className="text-foreground-muted">{langOpen ? '▲' : '▼'}</span>
        </button>
        {langOpen && (
          <div
            id={langMenuId}
            role="menu"
            aria-label={tc('language.label')}
            className="mt-2 rounded-xl border border-foreground/10 bg-surface overflow-hidden"
          >
            {SUPPORTED_LOCALES.map((loc, index) => (
              <button
                key={loc}
                ref={(node) => {
                  langOptionRefs.current[index] = node;
                }}
                type="button"
                onClick={() => handleLanguageChange(loc)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setLangOpen(false);
                    langButtonRef.current?.focus();
                    return;
                  }

                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    focusLanguageOption((index + 1) % SUPPORTED_LOCALES.length);
                    return;
                  }

                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    focusLanguageOption(
                      (index - 1 + SUPPORTED_LOCALES.length) % SUPPORTED_LOCALES.length,
                    );
                    return;
                  }

                  if (e.key === 'Home') {
                    e.preventDefault();
                    focusLanguageOption(0);
                    return;
                  }

                  if (e.key === 'End') {
                    e.preventDefault();
                    focusLanguageOption(SUPPORTED_LOCALES.length - 1);
                  }
                }}
                role="menuitemradio"
                aria-checked={loc === locale}
                className={`w-full flex items-center justify-between px-4 py-3 min-h-[44px] text-base transition-colors hover:bg-primary/5 cursor-pointer ${
                  loc === locale ? 'text-primary font-semibold' : 'text-foreground'
                }`}
              >
                <span dir="auto">{LOCALE_NAMES[loc]}</span>
                {loc === locale && <span className="text-primary">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sign Out */}
      {/* Sign out also returns to the landing page — WelcomeGate redirects any
       * stored session away from it, so this is the only route back. */}
      <SignOutButton className="mt-5 w-full" />

      {/* Legal Links */}
      <div className="mt-6 flex items-center justify-center gap-4 pb-4">
        <Link
          href="/terms"
          className="text-sm text-foreground-muted hover:text-primary transition-colors"
        >
          {tc('nav.terms')}
        </Link>
        <span className="text-foreground-muted">·</span>
        <Link
          href="/privacy"
          className="text-sm text-foreground-muted hover:text-primary transition-colors"
        >
          {tc('nav.privacy')}
        </Link>
      </div>
    </div>
  );
}
