'use client';

import { useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BackButton } from '@/components/ui/BackButton';
import { EmergencyAlert } from '@/components/ui/EmergencyAlert';
import { localeNumbers } from '@/components/ui/SafetyDisclosure';
import type { TranscriptLine, VoiceCallError, VoiceCallPhase } from './useVoiceCall';

export interface VoiceCallViewProps {
  phase: VoiceCallPhase;
  error: VoiceCallError | null;
  transcript: TranscriptLine[];
  emergency: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  backHref: string;
  textCoachHref: string;
  onStart: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onDismissEmergency: () => void;
}

/**
 * The voice call screen. Built for someone whose hands and attention are
 * elsewhere: one large control at a time, status in words, and the
 * emergency call button pinned to the bottom for the whole call — it never
 * depends on the agent or the safety check working.
 */
export function VoiceCallView({
  phase,
  error,
  transcript,
  emergency,
  isSpeaking,
  isMuted,
  backHref,
  textCoachHref,
  onStart,
  onEnd,
  onToggleMute,
  onDismissEmergency,
}: VoiceCallViewProps) {
  const t = useTranslations('coach');
  const tc = useTranslations('common');
  const locale = useLocale();
  const numbers = localeNumbers(locale);
  const live = phase === 'live';
  const busy = phase === 'starting' || live;

  const transcriptEnd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    transcriptEnd.current?.scrollIntoView?.({ block: 'end' });
  }, [transcript.length]);

  const status =
    phase === 'starting'
      ? t('voice.status.starting')
      : live
        ? isSpeaking
          ? t('voice.status.speaking')
          : t('voice.status.listening')
        : phase === 'ended'
          ? t('voice.status.ended')
          : t('voice.status.idle');

  return (
    <main className="flex h-full flex-col">
      <EmergencyAlert open={emergency} onDismiss={onDismissEmergency} />

      <header className="shrink-0 px-5 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <BackButton href={backHref} label={tc('nav.back')} />
          <h1
            className="text-xl font-medium text-foreground"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('voice.title')}
          </h1>
          <Link
            href={textCoachHref}
            className="focus-ring ms-auto rounded-full border border-foreground/15 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-foreground/5"
          >
            {t('voice.type_instead')}
          </Link>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center overflow-hidden px-5">
        {/* Status orb: breathes while listening, pulses faster while speaking. */}
        <div className="flex flex-col items-center pt-6 pb-4">
          <div
            aria-hidden="true"
            data-testid="voice-orb"
            className="relative flex h-36 w-36 items-center justify-center"
          >
            {/* Animated halo behind a static mic, so the animation never
             * fades the mic itself. */}
            <div
              className={[
                'absolute inset-0 rounded-full',
                live
                  ? isSpeaking
                    ? 'bg-primary/20 animate-pulse'
                    : 'bg-primary/10 animate-breathing'
                  : phase === 'starting'
                    ? 'bg-primary/10 animate-pulse'
                    : '',
              ].join(' ')}
            />
            <div
              className={`relative flex h-20 w-20 items-center justify-center rounded-full ${
                live ? 'bg-primary text-onPrimary' : 'bg-surface text-foreground-muted'
              } shadow-sm`}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0" />
                <path d="M12 18v3" />
              </svg>
            </div>
          </div>
          <p role="status" aria-live="polite" className="mt-4 text-lg font-medium text-foreground">
            {status}
          </p>
          {live && isMuted && (
            <p className="mt-1 text-sm text-foreground-muted">{t('voice.muted_notice')}</p>
          )}
        </div>

        {phase === 'idle' && (
          <p className="max-w-sm text-center text-base leading-relaxed text-foreground-muted">
            {t('voice.intro')}
          </p>
        )}

        {error && (
          <div
            role="alert"
            className="mt-2 w-full max-w-md rounded-xl border border-error/30 bg-error/5 p-4 text-center text-base text-foreground"
          >
            {t(`voice.error.${error}`)}
          </div>
        )}

        {transcript.length > 0 && (
          <section
            aria-label={t('voice.transcript_label')}
            className="mt-3 w-full max-w-md flex-1 space-y-2 overflow-y-auto pb-3"
          >
            {transcript.map((line) => (
              <div
                key={line.id}
                className={`flex ${line.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug ${
                    line.role === 'user'
                      ? 'bg-primary text-onPrimary'
                      : 'border border-foreground/10 bg-surface text-foreground'
                  }`}
                >
                  <span className="sr-only">
                    {line.role === 'user' ? t('voice.you') : t('voice.agent')}:{' '}
                  </span>
                  {line.text}
                </div>
              </div>
            ))}
            <div ref={transcriptEnd} />
          </section>
        )}
      </div>

      {/* Controls */}
      <div className="shrink-0 px-5 pb-3">
        <div className="mx-auto flex w-full max-w-md items-center gap-3">
          {busy ? (
            <>
              <button
                type="button"
                onClick={onToggleMute}
                disabled={!live}
                aria-pressed={isMuted}
                className="focus-ring min-h-[56px] flex-1 rounded-2xl border border-foreground/15 text-base font-semibold text-foreground hover:bg-foreground/5 disabled:opacity-50"
              >
                {isMuted ? t('voice.unmute') : t('voice.mute')}
              </button>
              <button
                type="button"
                onClick={onEnd}
                className="focus-ring min-h-[56px] flex-[1.4] rounded-2xl bg-foreground text-base font-semibold text-background hover:opacity-90"
              >
                {t('voice.end')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onStart}
              className="focus-ring min-h-[60px] w-full rounded-2xl bg-primary text-lg font-semibold text-onPrimary hover:bg-primary-dark"
            >
              {phase === 'idle'
                ? t('voice.start')
                : phase === 'error'
                  ? tc('actions.try_again')
                  : t('voice.start_again')}
            </button>
          )}
        </div>
      </div>

      {/* Emergency call, pinned for the whole call — independent of the agent
       * and of the safety check. Outside a call the app-wide EmergencyBar
       * below already covers it, so it isn't doubled up there. */}
      {busy && (
        <div className="shrink-0 px-5 pb-3">
          <a
            href={`tel:${numbers.emergency.replace(/[^+\d]/g, '')}`}
            className="focus-ring mx-auto flex min-h-[56px] w-full max-w-md items-center justify-center gap-2.5 rounded-2xl text-lg font-extrabold text-white"
            style={{ background: 'var(--color-emergency)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24 11.4 11.4 0 0 0 3.6.58 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .58 3.6 1 1 0 0 1-.25 1Z" />
            </svg>
            {t('voice.emergency_cta', { number: numbers.emergency })}
          </a>
          <p className="mx-auto mt-1.5 max-w-md text-center text-xs text-foreground-muted">
            {t('voice.emergency_hint')}
          </p>
        </div>
      )}
    </main>
  );
}
