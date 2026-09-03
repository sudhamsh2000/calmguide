'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

import { getSpeechStatus, synthesizeSpeech } from '@/lib/api';

interface UseSpeechSynthesisOptions {
  locale?: string;
}

interface UseSpeechSynthesisReturn {
  speak: (text: string) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  isSpeaking: boolean;
  isPaused: boolean;
  /** Whether the browser's own Web Speech API is present. */
  isSupported: boolean;
  /**
   * Whether read-aloud can happen at all, by either path. Neural playback uses
   * an <audio> element and does not touch the Web Speech API, so a browser
   * without speechSynthesis can still read aloud perfectly well. UI should gate
   * on this rather than `isSupported`, which would hide the control on those
   * browsers even though the server-side voice works.
   */
  canSpeak: boolean;
}

/**
 * Chrome silently stops speechSynthesis roughly 15 seconds into an utterance.
 * A full Moment Coach response read through the local fallback runs far past
 * that, so it would cut off mid-sentence with no error and no `onend`. Calling
 * resume() periodically keeps it going; it is a no-op on engines without the
 * bug, so it costs nothing elsewhere.
 */
const CHROME_RESUME_INTERVAL_MS = 10_000;

/**
 * Warmer, calmer delivery than the browser's raw defaults (rate 1 / pitch 1
 * reads flat and clinical — exactly the "system voiceover" feel we don't
 * want for a caregiver at 3am). Subtle on purpose: slowed down slightly for
 * a calm pace, pitch nudged up just enough to sound friendly rather than
 * flat, without tipping into cartoonish.
 */
const SPEECH_RATE = 0.95;
const SPEECH_PITCH = 1.05;

/**
 * Name fragments (case-insensitive) of voices that are known to sound
 * natural rather than robotic, roughly in preference order, across the
 * platforms CalmGuide actually ships on (macOS/iOS Safari, Chrome/Edge on
 * Windows and Android). The Web Speech API gives no reliable quality
 * signal — `localService` doesn't correlate with quality consistently
 * across platforms — so this is a maintained allowlist rather than a
 * heuristic. Falls back to the platform default for the locale if none of
 * these are installed.
 *
 * "Samantha" for English is confirmed good (tested, not flagged) and stays
 * top priority so this change doesn't touch a voice nobody complained
 * about. "Mónica" for Spanish was tested and reported as not friendly
 * enough, so for es specifically, Apple's newer cross-language voice set
 * (macOS Ventura+ / iOS 16+, shipped under the same names in every
 * language — a generation newer and generally warmer than the classic
 * single-name voices) gets a chance to win instead, ahead of Mónica as a
 * fallback. Skipped "Grandma"/"Grandpa" from that same newer set on
 * purpose — warm, but age-codes the voice in a way that doesn't fit every
 * response.
 */
const PREFERRED_VOICE_NAMES = [
  // macOS / iOS Safari classic high-quality voices, per language
  'Ava',
  'Samantha',
  'Allison',
  'Susan',
  'Zoe',
  'Nicky', // en
  // Newer cross-language voice set — currently only tried for es (Mónica
  // wasn't warm enough); see note above before widening this to other
  // locales without it being requested.
  'Reed',
  'Shelley',
  'Flo',
  'Mónica',
  'Paulina', // es fallback
  // Chrome/Edge network-backed voices, notably better than local ones
  'Google US English',
  'Google UK English Female',
  'Google español',
  'Microsoft Aria',
  'Microsoft Jenny',
  'Microsoft Sonia',
];

function pickVoice(
  voices: SpeechSynthesisVoice[],
  locale: string,
): SpeechSynthesisVoice | undefined {
  const localeMatches = voices.filter((v) => v.lang.toLowerCase().startsWith(locale.toLowerCase()));
  if (localeMatches.length === 0) return undefined;

  for (const preferred of PREFERRED_VOICE_NAMES) {
    const match = localeMatches.find((v) => v.name.toLowerCase().includes(preferred.toLowerCase()));
    if (match) return match;
  }

  // No known-good voice installed — prefer a network-backed voice over a
  // compact on-device one where the platform actually tells us which is
  // which (Chrome does; Safari reports everything as local).
  return localeMatches.find((v) => !v.localService) ?? localeMatches[0];
}

export function useSpeechSynthesis(
  options: UseSpeechSynthesisOptions = {},
): UseSpeechSynthesisReturn {
  const { locale } = options;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Neural TTS, when the server has it enabled. The browser's own voices are
  // limited to the platform's basic bundled set, which reads robotically no
  // matter how it's tuned — see app/services/speech.py. `neuralRef` holds the
  // active <audio> element and its object URL so playback can be stopped and
  // the URL revoked without leaking.
  const [neuralAvailable, setNeuralAvailable] = useState(false);
  const neuralRef = useRef<{ audio: HTMLAudioElement; url: string } | null>(null);
  // Guards against an out-of-order response: if the user stops or starts a new
  // read while synthesis is still in flight, the stale audio must not play.
  const requestIdRef = useRef(0);
  // Keep-alive for Chrome's 15s cutoff, and a flag so it never fights a pause
  // the caregiver asked for.
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userPausedRef = useRef(false);

  const clearKeepAlive = useCallback(() => {
    if (keepAliveRef.current !== null) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
  }, []);

  useEffect(() => {
    const supported = typeof window !== 'undefined' && !!window.speechSynthesis;
    setIsSupported(supported);
    if (!supported) return;

    // Chrome (and some other browsers) return an empty voice list until
    // they've asynchronously loaded the platform's voices and fired
    // `voiceschanged` — calling getVoices() once here warms that cache so
    // the first real speak() call already has the full list to choose
    // from, instead of silently falling back to whatever default voice
    // happens to be active before loading finishes.
    window.speechSynthesis.getVoices();

    // Warming is not enough on its own: on a cold load the list can still be
    // empty at this point, and nothing would re-read it. Listening for
    // `voiceschanged` means a caregiver who presses read-aloud early gets the
    // preferred voice on their next press rather than the flat default.
    const onVoicesChanged = () => {
      window.speechSynthesis.getVoices();
    };
    window.speechSynthesis.addEventListener?.('voiceschanged', onVoicesChanged);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', onVoicesChanged);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getSpeechStatus().then((ok) => {
      if (!cancelled) setNeuralAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Tear down any in-flight neural playback and release its object URL. */
  const stopNeural = useCallback(() => {
    const current = neuralRef.current;
    if (!current) return;
    // Detach handlers first: assigning `src = ''` below fires the <audio>
    // element's own `error` event, which would otherwise reach onerror and
    // trigger the local-voice fallback right after a successful playback —
    // reading every response aloud twice, once neural then once robotic.
    current.audio.onended = null;
    current.audio.onerror = null;
    current.audio.pause();
    current.audio.src = '';
    URL.revokeObjectURL(current.url);
    neuralRef.current = null;
  }, []);

  const stop = useCallback(() => {
    requestIdRef.current += 1; // invalidate any synthesis still in flight
    clearKeepAlive();
    userPausedRef.current = false;
    stopNeural();
    if (isSupported) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, [isSupported, stopNeural, clearKeepAlive]);

  /** Browser-local speech. Always available as the fallback path. */
  const speakLocal = useCallback(
    (text: string) => {
      if (!isSupported) return;
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;
      utterance.rate = SPEECH_RATE;
      utterance.pitch = SPEECH_PITCH;

      if (locale) {
        const voices = window.speechSynthesis.getVoices();
        const match = pickVoice(voices, locale);
        if (match) utterance.voice = match;
        utterance.lang = locale;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsPaused(false);
        // See CHROME_RESUME_INTERVAL_MS. Only nudges when the caregiver has not
        // deliberately paused, so this can't undo their own pause.
        clearKeepAlive();
        keepAliveRef.current = setInterval(() => {
          if (!userPausedRef.current && window.speechSynthesis.speaking) {
            window.speechSynthesis.resume();
          }
        }, CHROME_RESUME_INTERVAL_MS);
      };
      utterance.onend = () => {
        clearKeepAlive();
        userPausedRef.current = false;
        setIsSpeaking(false);
        setIsPaused(false);
      };
      utterance.onerror = () => {
        clearKeepAlive();
        userPausedRef.current = false;
        setIsSpeaking(false);
        setIsPaused(false);
      };
      utterance.onpause = () => setIsPaused(true);
      utterance.onresume = () => setIsPaused(false);

      window.speechSynthesis.speak(utterance);
    },
    [isSupported, locale, clearKeepAlive],
  );

  /**
   * Speak `text`, preferring the neural voice and falling back to the
   * browser's own on any failure. Marked speaking immediately rather than on
   * playback start, so the button reacts to the press even though synthesis
   * takes a moment — otherwise it reads as an unresponsive control.
   */
  const speak = useCallback(
    (text: string) => {
      stop();
      const requestId = requestIdRef.current;

      if (!neuralAvailable) {
        speakLocal(text);
        return;
      }

      setIsSpeaking(true);
      synthesizeSpeech(text)
        .then((url) => {
          // Superseded by a newer press, or stopped while synthesizing.
          if (requestId !== requestIdRef.current) {
            if (url) URL.revokeObjectURL(url);
            return;
          }
          if (!url) {
            setIsSpeaking(false);
            speakLocal(text);
            return;
          }

          const audio = new Audio(url);
          neuralRef.current = { audio, url };
          audio.onended = () => {
            setIsSpeaking(false);
            setIsPaused(false);
            stopNeural();
          };
          audio.onerror = () => {
            // Synthesis succeeded but playback didn't; still better to read it
            // aloud badly than not at all.
            setIsSpeaking(false);
            stopNeural();
            speakLocal(text);
          };
          audio.play().catch(() => {
            setIsSpeaking(false);
            stopNeural();
            speakLocal(text);
          });
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) return;
          setIsSpeaking(false);
          speakLocal(text);
        });
    },
    [neuralAvailable, speakLocal, stop, stopNeural],
  );

  const pause = useCallback(() => {
    userPausedRef.current = true;
    if (neuralRef.current) {
      neuralRef.current.audio.pause();
      setIsPaused(true);
      return;
    }
    if (!isSupported) return;
    window.speechSynthesis.pause();
  }, [isSupported]);

  const resume = useCallback(() => {
    userPausedRef.current = false;
    if (neuralRef.current) {
      void neuralRef.current.audio.play();
      setIsPaused(false);
      return;
    }
    if (!isSupported) return;
    window.speechSynthesis.resume();
  }, [isSupported]);

  useEffect(() => {
    return () => {
      clearKeepAlive();
      stopNeural();
      if (isSupported) window.speechSynthesis?.cancel();
    };
  }, [isSupported, stopNeural, clearKeepAlive]);

  return {
    speak,
    stop,
    pause,
    resume,
    isSpeaking,
    isPaused,
    isSupported,
    canSpeak: isSupported || neuralAvailable,
  };
}
