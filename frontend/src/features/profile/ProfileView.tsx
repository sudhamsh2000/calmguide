'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Link, useRouter, usePathname } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useProfile } from '@/context/ProfileContext';
import {
  getPatientName,
  getAccessCode,
  getActiveProfileAvatar,
  getAutoSpeakReplies,
  setAutoSpeakReplies,
  type ProfileAvatar as ProfileAvatarKind,
  noSessionRedirectPath,
} from '@/lib/storage';
import { getProfile } from '@/lib/api';
import { BackButton } from '@/components/ui/BackButton';
import { ProfileAvatar } from '@/components/ui/ProfileAvatar';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Switch } from '@/components/ui/Switch';
import { SUPPORTED_LOCALES, LOCALE_NAMES, type SupportedLocale } from '@/lib/locale';
import { OpenMRSConnection } from './OpenMRSConnection';

const CONNECTED_SERVICES = [
  {
    id: 'openmrs',
    name: 'OpenMRS',
    hintKey: 'services.openmrs_hint',
    icon: (
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <g fill="none" strokeWidth="5" strokeLinecap="butt">
          <path d="M16 4a12 12 0 0 1 12 12" stroke="#E8543E" />
          <path d="M28 16a12 12 0 0 1-12 12" stroke="#F2A93B" />
          <path d="M16 28A12 12 0 0 1 4 16" stroke="#4CAF6A" />
          <path d="M4 16A12 12 0 0 1 16 4" stroke="#3E7FD0" />
        </g>
      </svg>
    ),
  },
  {
    id: 'fitbit',
    name: 'Google Fitbit',
    hintKey: 'services.fitbit_hint',
    icon: (
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" fill="#2CB5B5">
        {[
          [16, 3, 2.6],
          [16, 9.5, 3],
          [9.5, 9.5, 2.4],
          [22.5, 9.5, 2.4],
          [3, 16, 2.4],
          [9.5, 16, 3],
          [16, 16, 3.4],
          [22.5, 16, 3],
          [29, 16, 2.4],
          [9.5, 22.5, 2.4],
          [16, 22.5, 3],
          [22.5, 22.5, 2.4],
          [16, 29, 2.6],
        ].map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
        ))}
      </svg>
    ),
  },
] as const;

export interface ProfileViewProps {
  className?: string;
}

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
  const [avatar, setAvatar] = useState<ProfileAvatarKind>('monogram');
  useEffect(() => {
    setAutoSpeakState(getAutoSpeakReplies());
  }, []);
  const handleAutoSpeakChange = (checked: boolean) => {
    setAutoSpeakState(checked);
    setAutoSpeakReplies(checked);
  };
  const [langOpen, setLangOpen] = useState(false);
  const [pendingService, setPendingService] = useState<string | null>(null);
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
      router.push(noSessionRedirectPath());
      return;
    }

    setPatientNameState(name);
    setAccessCodeState(code);
    setAvatar(getActiveProfileAvatar());

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

  const formattedCode =
    accessCode.length === 8 ? `${accessCode.slice(0, 4)} · ${accessCode.slice(4)}` : accessCode;

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

  const sectionLabel =
    'text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted mb-2.5';
  const chip = 'inline-flex items-center rounded-full px-4 py-2 text-[15px] font-medium';

  const renderChips = (
    items: string[],
    group: 'behavioral' | 'calming' | 'safety',
    tone: string,
  ) =>
    items.length > 0 ? (
      <div className="flex flex-wrap gap-2.5">
        {items.map((item) => (
          <span key={item} className={`${chip} ${tone}`}>
            {translateProfileOption(group, item)}
          </span>
        ))}
      </div>
    ) : (
      <p className="text-sm text-foreground-muted">{t('view.none_recorded')}</p>
    );

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-4 pb-3">
        <BackButton href="/home" label={tc('nav.back_to_home')} />
        <h1
          className="text-2xl font-medium text-foreground"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('view.title')}
        </h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-stretch">
        {/* Care details — everything Moment Coach knows about the person,
         * in one card so it reads as a single record rather than a stack. */}
        <section aria-labelledby="care-details-heading" className="card-shell px-6 py-5">
          <h2 id="care-details-heading" className="text-xl font-semibold text-foreground">
            {t('view.care_details')}
          </h2>

          <div className="mt-4 flex items-center gap-4 pb-5">
            <ProfileAvatar
              name={patientName}
              avatar={avatar}
              diseaseStage={diseaseStage}
              size={76}
            />
            <div>
              <p className="text-lg font-semibold text-foreground">{patientName}</p>
              <p className="mt-0.5 text-sm text-foreground-muted">{t('view.name_hint')}</p>
            </div>
          </div>

          <div className="border-t border-theme-soft py-5">
            <p className={sectionLabel}>{t('view.dementia_stage')}</p>
            <p className="text-lg text-foreground">{stageLabels[diseaseStage] ?? diseaseStage}</p>
          </div>

          <div className="border-t border-theme-soft py-5">
            <p className={sectionLabel}>{t('view.behavioral_patterns')}</p>
            {renderChips(
              profile?.behavioral_patterns ?? [],
              'behavioral',
              'bg-primary-soft text-foreground',
            )}
          </div>

          <div className="border-t border-theme-soft py-5">
            <p className={sectionLabel}>{t('view.calming_strategies')}</p>
            {renderChips(
              profile?.calming_strategies ?? [],
              'calming',
              'bg-success-bg text-success-text',
            )}
          </div>

          <div className="border-t border-theme-soft pt-5">
            <p className={sectionLabel}>{t('view.safety_concerns')}</p>
            {renderChips(profile?.safety_concerns ?? [], 'safety', 'bg-error-bg text-error')}
          </div>
        </section>

        <div className="flex flex-col gap-4">
          {/* Profile access */}
          <section aria-labelledby="profile-access-heading" className="card-shell px-6 py-5">
            <h2 id="profile-access-heading" className="text-xl font-semibold text-foreground">
              {t('view.profile_access')}
            </h2>
            <div className="mt-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted">
                {t('view.access_code')}
              </p>
              <p className="mt-1.5 whitespace-pre text-3xl font-bold tracking-[0.08em] text-foreground">
                {formattedCode}
              </p>
              <p className="mt-1.5 text-sm text-foreground-muted">{t('view.access_code_hint')}</p>
            </div>
            <Link
              href="/profile/edit"
              className="mt-4 flex min-h-tap items-center justify-center rounded-xl bg-primary px-6 py-3 text-base font-semibold text-onPrimary transition-opacity hover:opacity-90 focus-ring"
            >
              {t('actions.edit')}
            </Link>
          </section>

          {/* Preferences */}
          <section aria-labelledby="preferences-heading" className="card-shell px-6 py-5">
            <h2 id="preferences-heading" className="text-xl font-semibold text-foreground">
              {t('view.preferences')}
            </h2>

            <div className="mt-3 pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted">
                {t('voice.label')}
              </p>
              <div className="mt-1 flex items-start justify-between gap-4">
                <span className="text-base text-foreground">{t('voice.auto_speak_replies')}</span>
                <Switch
                  checked={autoSpeak}
                  onChange={handleAutoSpeakChange}
                  label={t('voice.auto_speak_replies')}
                />
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-foreground-muted">
                {t('voice.auto_speak_replies_hint')}
              </p>
            </div>

            <div className="border-t border-theme-soft py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted">
                {t('appearance')}
              </p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-base text-foreground">{t('appearance')}</span>
                <ThemeToggle />
              </div>
            </div>

            <div className="border-t border-theme-soft pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted mb-2">
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
                className="w-full flex items-center justify-between rounded-xl border border-border dark:border-theme-soft bg-surface px-4 py-2.5 min-h-tap text-base text-foreground transition-all hover:border-primary/20 hover:bg-primary/[0.025] dark:hover:border-primary/25 dark:hover:bg-primary/[0.05] focus-ring cursor-pointer"
              >
                <span dir="auto">{LOCALE_NAMES[locale as SupportedLocale] ?? locale}</span>
                <span aria-hidden="true" className="text-sm text-foreground-muted">
                  {langOpen ? '▲' : '▼'}
                </span>
              </button>
              {langOpen && (
                <div
                  id={langMenuId}
                  role="menu"
                  aria-label={tc('language.label')}
                  className="mt-2 rounded-xl border border-theme-soft bg-surface overflow-hidden"
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
          </section>

          {/* Connected services — OpenMRS links the person's health record
           * when the server has it enabled (and says "Coming soon" when not);
           * Fitbit isn't built yet, so its Connect says so in place. */}
          <section aria-labelledby="services-heading" className="card-shell px-6 py-5">
            <h2 id="services-heading" className="text-xl font-semibold text-foreground">
              {t('services.title')}
            </h2>
            <p className="mt-1 text-sm text-foreground-muted">{t('services.description')}</p>
            <ul className="mt-2">
              {CONNECTED_SERVICES.map((service, index) =>
                service.id === 'openmrs' ? (
                  <li key={service.id} className={index > 0 ? 'border-t border-theme-soft' : ''}>
                    <OpenMRSConnection
                      accessCode={accessCode}
                      patientName={patientName}
                      name={service.name}
                      hint={t(service.hintKey)}
                      icon={service.icon}
                    />
                  </li>
                ) : (
                  <li
                    key={service.id}
                    className={`flex items-center gap-4 py-2.5 ${
                      index > 0 ? 'border-t border-theme-soft' : ''
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center">
                      {service.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-foreground">{service.name}</p>
                      <p className="text-[13px] text-foreground-muted">{t(service.hintKey)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingService(service.id)}
                      disabled={pendingService === service.id}
                      className="min-h-[44px] shrink-0 rounded-xl border border-border dark:border-theme-soft bg-surface px-5 text-sm font-semibold text-accentSky transition-colors hover:bg-accentSky-soft disabled:cursor-default disabled:text-foreground-muted disabled:hover:bg-surface focus-ring"
                    >
                      {pendingService === service.id
                        ? t('services.coming_soon')
                        : t('services.connect')}
                    </button>
                  </li>
                ),
              )}
            </ul>
          </section>
        </div>
      </div>

      {/* Legal links — signed-in caregivers are redirected away from the
       * landing page, so this is their route to the terms and privacy notice. */}
      <div className="mt-5 flex items-center justify-center gap-4">
        <Link
          href="/terms"
          className="text-sm text-foreground-muted hover:text-primary transition-colors"
        >
          {tc('nav.terms')}
        </Link>
        <span aria-hidden="true" className="text-foreground-muted">
          ·
        </span>
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
