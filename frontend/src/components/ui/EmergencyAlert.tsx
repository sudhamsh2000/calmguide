'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { localeNumbers } from './SafetyDisclosure';

/**
 * Full-screen red alert shown when the safety gate returns an EMERGENCY
 * decision. Deliberately louder than the rest of the app, which is otherwise
 * built to stay calm.
 *
 * Three constraints shaped this:
 *
 * 1. **Portalled to document.body.** A `fixed inset-0` overlay only escapes
 *    the page if no ancestor creates a stacking context, and the coach screen
 *    has several. Rendering in place put a dialog behind the page once
 *    already (see ConfirmDialog).
 * 2. **The tone is an attention cue, not an alarm.** This plays in a house
 *    where someone has dementia, often at night. A siren risks startling the
 *    patient and escalating the very situation the caregiver is asking about,
 *    so it is two short, soft sine pulses, played once, and mutable — the
 *    preference persists.
 * 3. **Dismissal is deliberate.** No click-outside-to-close: an accidental
 *    tap must not clear a 911 prompt. Escape works, and the button is
 *    explicit.
 *
 * The emergency number comes from `localeNumbers`, so a Hindi caregiver is
 * shown 112 rather than 911.
 */

const MUTE_KEY = 'calmguide_emergency_sound_muted';

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeMuted(value: boolean): void {
  try {
    window.localStorage.setItem(MUTE_KEY, value ? 'true' : 'false');
  } catch {
    /* private mode / blocked storage — the alert still works, it just won't remember */
  }
}

/** Two short sine pulses via Web Audio. No asset, so it works offline. */
function playAttentionTone(): void {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    // Browsers block audio without a prior gesture; submitting the message is
    // that gesture, so this normally resolves. If it doesn't, stay silent.
    const now = ctx.currentTime;
    [0, 0.42].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now + offset);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.16, now + offset + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.32);
    });
    window.setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch {
    /* audio unavailable — the visual alert carries it */
  }
}

export interface EmergencyAlertProps {
  open: boolean;
  onDismiss: () => void;
}

export function EmergencyAlert({ open, onDismiss }: EmergencyAlertProps) {
  const t = useTranslations('coach');
  const locale = useLocale();
  const numbers = localeNumbers(locale);
  const [mounted, setMounted] = useState(false);
  const [muted, setMuted] = useState(false);
  const dismissRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
    setMuted(readMuted());
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!readMuted()) playAttentionTone();
    dismissRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onDismiss]);

  if (!open || !mounted) return null;

  const telHref = `tel:${numbers.emergency.replace(/[^+\d]/g, '')}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(28, 8, 4, 0.62)' }}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="emergency-alert-title"
        aria-describedby="emergency-alert-body"
        className="w-full max-w-[420px] overflow-hidden rounded-[28px] text-white shadow-2xl"
        style={{
          background: 'linear-gradient(160deg, var(--color-emergency) 0%, #7d2a1c 100%)',
          border: '2px solid rgba(255,255,255,0.28)',
        }}
      >
        <div className="flex flex-col items-center px-6 pt-7 pb-6 text-center">
          <span
            aria-hidden="true"
            className="emergency-alert-pulse mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.18)' }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v5" />
              <circle cx="12" cy="17.5" r="0.6" fill="currentColor" />
              <path d="M10.3 3.2 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0Z" />
            </svg>
          </span>

          <h2
            id="emergency-alert-title"
            className="text-[26px] font-extrabold leading-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('emergency_alert.title')}
          </h2>
          <p id="emergency-alert-body" className="mt-2.5 text-[15px] leading-relaxed text-white/90">
            {t('emergency_alert.body')}
          </p>

          <a
            href={telHref}
            className="focus-ring mt-6 flex min-h-[60px] w-full items-center justify-center gap-3 rounded-2xl bg-white text-[22px] font-extrabold tracking-wide"
            style={{ color: 'var(--color-emergency)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24 11.4 11.4 0 0 0 3.6.58 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .58 3.6 1 1 0 0 1-.25 1Z" />
            </svg>
            {t('emergency_alert.call', { number: numbers.emergency })}
          </a>

          <a
            href={`tel:${numbers.helpline.replace(/[^+\d]/g, '')}`}
            className="focus-ring mt-2.5 flex min-h-[48px] w-full items-center justify-center rounded-2xl text-[15px] font-semibold text-white"
            style={{ background: 'rgba(255,255,255,0.16)' }}
          >
            {numbers.helplineName}
          </a>

          <div className="mt-5 flex w-full items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                const next = !muted;
                setMuted(next);
                writeMuted(next);
              }}
              className="focus-ring rounded-lg px-2 py-1 text-[13px] font-medium text-white/75 underline-offset-2 hover:underline"
            >
              {muted ? t('emergency_alert.sound_off') : t('emergency_alert.sound_on')}
            </button>
            <button
              ref={dismissRef}
              type="button"
              onClick={onDismiss}
              className="focus-ring rounded-xl px-4 py-2 text-[15px] font-semibold text-white"
              style={{ background: 'rgba(255,255,255,0.16)' }}
            >
              {t('emergency_alert.dismiss')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
