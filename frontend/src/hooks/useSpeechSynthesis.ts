'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { getSpeechStatus, synthesizeSpeech } from '@/lib/api';

interface UseSpeechSynthesisOptions {
  locale?: string;
}

interface UseSpeechSynthesisReturn {
  speak: (text: string) => void;
  /**
   * Streamed read-aloud: start an empty reading, then append text as it
   * arrives. Each appended piece is synthesized straight away and played in
   * order, so reading starts on the first sentence and runs to the end of
   * the reply (or until stopped). Ends once `endStream` is called and the
   * queue has played out.
   */
  startStream: () => void;
  appendToStream: (text: string) => void;
  endStream: () => void;
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

/**
 * Module-level playback state, shared by every component using this hook.
 *
 * Only one thing can audibly play at a time, but each call site (the
 * per-message SpeakButton, plus the page-level auto-speak-on-reply effect)
 * used to keep its own private `isSpeaking`/`isPaused` state and its own
 * private <audio> ref. That meant a SpeakButton had no way to know that
 * *some other* instance had started playback: tapping it saw its own
 * `isSpeaking === false` and started a second, overlapping read instead of
 * stopping the first, and leaving the page only tore down whichever
 * instance happened to unmount — not whatever was actually still playing.
 * Hoisting the live state here gives every instance the same view of what's
 * really happening, and lets any of them stop it.
 */
interface SharedSpeechState {
  isSpeaking: boolean;
  isPaused: boolean;
}

let sharedState: SharedSpeechState = { isSpeaking: false, isPaused: false };
const listeners = new Set<() => void>();

function setSharedState(patch: Partial<SharedSpeechState>) {
  sharedState = { ...sharedState, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribeShared(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSharedSnapshot(): SharedSpeechState {
  return sharedState;
}

function getServerSnapshot(): SharedSpeechState {
  return { isSpeaking: false, isPaused: false };
}

// Neural TTS, when the server has it enabled. The browser's own voices are
// limited to the platform's basic bundled set, which reads robotically no
// matter how it's tuned — see app/services/speech.py.
let neuralPlayback: { audio: HTMLAudioElement; url: string } | null = null;
// Guards against an out-of-order response: if the caregiver stops or starts a
// new read while synthesis is still in flight, the stale audio must not play.
let activeRequestId = 0;
// Keep-alive for Chrome's 15s cutoff, and a flag so it never fights a pause
// the caregiver asked for.
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
let userPaused = false;

/**
 * How many `useSpeechSynthesis()` instances are currently mounted anywhere
 * on the page. Moment Coach mounts one instance per rendered section
 * (SpeakButton) plus one page-level instance for auto-speak, and those
 * per-section instances mount and unmount individually as sections appear
 * during streaming (CoachResponseRenderer swaps its raw-response fallback
 * for the sectioned view once section markers are detected) — not only
 * "together on navigation" as originally assumed. Calling stopAll() from
 * every instance's unmount used to nuke ANY in-flight request — including
 * one just started by a completely different instance, such as the
 * page-level auto-speak effect's synthesizeSpeech() call racing a
 * SpeakButton mounting/unmounting as the next section streams in — because
 * stopAll() bumps the shared activeRequestId and the resolved fetch then
 * finds itself invalidated. Only stop playback when the LAST instance
 * leaves, which is what "the caregiver left this screen" actually means.
 */
let mountedInstanceCount = 0;

function clearKeepAlive() {
  if (keepAliveTimer !== null) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

/** Tear down any in-flight neural playback and release its object URL. */
function stopNeural() {
  const current = neuralPlayback;
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
  neuralPlayback = null;
}

/**
 * Streamed read-aloud (see `startStream` in the hook's return type). The
 * next few pieces are synthesized while the current one plays, so each is
 * ready by the time the one before it finishes. Only a few at a time:
 * sending every sentence at once slows down the one needed first.
 */
const STREAM_LOOKAHEAD = 3;

/**
 * A streamed piece is a sentence or two, which normally synthesizes in 1-3s.
 * In testing roughly one request in five hung upstream instead, and a hung
 * request for the first sentence is exactly the silence this is meant to
 * remove. So a piece not back after STREAM_HEDGE_MS gets a second, identical
 * request and whichever answers first is played. Past the timeout the piece
 * is read with the local voice and the reading carries on.
 */
const STREAM_HEDGE_MS = 3500;
const STREAM_PIECE_TIMEOUT_MS = 8000;

function synthesizePiece(text: string): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    let pending = 0;
    const attempt = () => {
      pending += 1;
      void synthesizeSpeech(text, STREAM_PIECE_TIMEOUT_MS).then((url) => {
        pending -= 1;
        if (settled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        // A failure only counts once no other attempt could still succeed.
        if (url || pending === 0) {
          settled = true;
          clearTimeout(hedgeTimer);
          resolve(url);
        }
      });
    };
    const hedgeTimer = setTimeout(() => {
      if (!settled) attempt();
    }, STREAM_HEDGE_MS);
    attempt();
  });
}

interface StreamPiece {
  text: string;
  /** Neural audio object URL once requested; null means not requested yet. */
  audio: Promise<string | null> | null;
}

interface SpeechStream {
  requestId: number;
  locale?: string;
  neural: boolean;
  queue: StreamPiece[];
  /** A piece is being synthesized-then-played, or spoken locally. */
  busy: boolean;
  /** No more pieces are coming. */
  ended: boolean;
}

let speechStream: SpeechStream | null = null;

function isCurrentStream(stream: SpeechStream): boolean {
  return speechStream === stream && stream.requestId === activeRequestId;
}

function dropStream() {
  const stream = speechStream;
  if (!stream) return;
  speechStream = null;
  for (const piece of stream.queue) {
    void piece.audio?.then((url) => {
      if (url) URL.revokeObjectURL(url);
    });
  }
}

function stopAll() {
  activeRequestId += 1; // invalidate any synthesis still in flight
  dropStream();
  clearKeepAlive();
  userPaused = false;
  stopNeural();
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  setSharedState({ isSpeaking: false, isPaused: false });
}

/**
 * Browser-local speech. Always available as the fallback path. With
 * `onDone`, finishing hands control back to the caller (the stream queue)
 * instead of marking read-aloud as finished.
 */
function speakLocal(text: string, locale?: string, onDone?: () => void) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = SPEECH_RATE;
  utterance.pitch = SPEECH_PITCH;

  if (locale) {
    const voices = window.speechSynthesis.getVoices();
    const match = pickVoice(voices, locale);
    if (match) utterance.voice = match;
    utterance.lang = locale;
  }

  utterance.onstart = () => {
    setSharedState({ isSpeaking: true, isPaused: false });
    // See CHROME_RESUME_INTERVAL_MS. Only nudges when the caregiver has not
    // deliberately paused, so this can't undo their own pause.
    clearKeepAlive();
    keepAliveTimer = setInterval(() => {
      if (!userPaused && window.speechSynthesis.speaking) {
        window.speechSynthesis.resume();
      }
    }, CHROME_RESUME_INTERVAL_MS);
  };
  utterance.onend = () => {
    clearKeepAlive();
    userPaused = false;
    if (onDone) onDone();
    else setSharedState({ isSpeaking: false, isPaused: false });
  };
  utterance.onerror = () => {
    clearKeepAlive();
    userPaused = false;
    if (onDone) onDone();
    else setSharedState({ isSpeaking: false, isPaused: false });
  };
  utterance.onpause = () => setSharedState({ isPaused: true });
  utterance.onresume = () => setSharedState({ isPaused: false });

  window.speechSynthesis.speak(utterance);
}

/**
 * Speak `text`, preferring the neural voice and falling back to the
 * browser's own on any failure. Marked speaking immediately rather than on
 * playback start, so the button reacts to the press even though synthesis
 * takes a moment — otherwise it reads as an unresponsive control.
 */
function speak(text: string, locale: string | undefined, neuralAvailable: boolean) {
  stopAll();
  const requestId = activeRequestId;

  if (!neuralAvailable) {
    speakLocal(text, locale);
    return;
  }

  setSharedState({ isSpeaking: true, isPaused: false });
  synthesizeSpeech(text)
    .then((url) => {
      // Superseded by a newer press, or stopped while synthesizing.
      if (requestId !== activeRequestId) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      if (!url) {
        setSharedState({ isSpeaking: false });
        speakLocal(text, locale);
        return;
      }

      const audio = new Audio(url);
      neuralPlayback = { audio, url };
      audio.onended = () => {
        setSharedState({ isSpeaking: false, isPaused: false });
        stopNeural();
      };
      audio.onerror = () => {
        // Synthesis succeeded but playback didn't; still better to read it
        // aloud badly than not at all.
        setSharedState({ isSpeaking: false });
        stopNeural();
        speakLocal(text, locale);
      };
      audio.play().catch(() => {
        setSharedState({ isSpeaking: false });
        stopNeural();
        speakLocal(text, locale);
      });
    })
    .catch(() => {
      if (requestId !== activeRequestId) return;
      setSharedState({ isSpeaking: false });
      speakLocal(text, locale);
    });
}

function startStream(locale: string | undefined, neuralAvailable: boolean) {
  stopAll();
  speechStream = {
    requestId: activeRequestId,
    locale,
    neural: neuralAvailable,
    queue: [],
    busy: false,
    ended: false,
  };
  // Speaking from the moment the caregiver sends, so the stop control is
  // there before the first sentence has even arrived.
  setSharedState({ isSpeaking: true, isPaused: false });
}

function appendToStream(text: string) {
  const stream = speechStream;
  if (!stream || !isCurrentStream(stream) || stream.ended || !text.trim()) return;
  stream.queue.push({ text, audio: null });
  playNextInStream();
}

function prefetchStream(stream: SpeechStream) {
  if (!stream.neural) return;
  for (const piece of stream.queue.slice(0, STREAM_LOOKAHEAD)) {
    piece.audio ??= synthesizePiece(piece.text);
  }
}

function endStream() {
  const stream = speechStream;
  if (!stream || !isCurrentStream(stream)) return;
  stream.ended = true;
  playNextInStream();
}

function playNextInStream() {
  const stream = speechStream;
  if (!stream || !isCurrentStream(stream)) return;
  prefetchStream(stream);
  if (stream.busy || userPaused) return;

  const piece = stream.queue.shift();
  if (!piece) {
    if (stream.ended) {
      speechStream = null;
      setSharedState({ isSpeaking: false, isPaused: false });
    }
    return;
  }

  stream.busy = true;
  const done = () => {
    if (!isCurrentStream(stream)) return;
    stream.busy = false;
    playNextInStream();
  };
  const speakPieceLocally = () => speakLocal(piece.text, stream.locale, done);

  if (!stream.neural) {
    speakPieceLocally();
    return;
  }
  const pieceAudio = piece.audio ?? synthesizePiece(piece.text);
  prefetchStream(stream);
  pieceAudio
    .then((url) => {
      if (!isCurrentStream(stream)) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      if (!url) {
        speakPieceLocally();
        return;
      }
      const audio = new Audio(url);
      neuralPlayback = { audio, url };
      audio.onended = () => {
        stopNeural();
        done();
      };
      audio.onerror = () => {
        stopNeural();
        speakPieceLocally();
      };
      // Paused while this piece was synthesizing: resumeAll plays it.
      if (userPaused) return;
      audio.play().catch(() => {
        stopNeural();
        speakPieceLocally();
      });
    })
    .catch(() => {
      if (isCurrentStream(stream)) speakPieceLocally();
    });
}

function pauseAll() {
  userPaused = true;
  if (neuralPlayback) {
    neuralPlayback.audio.pause();
    setSharedState({ isPaused: true });
    return;
  }
  if (speechStream) {
    // Between two streamed pieces nothing is playing yet; the flag holds
    // back the next one.
    setSharedState({ isPaused: true });
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.pause();
  }
}

function resumeAll() {
  userPaused = false;
  if (neuralPlayback) {
    void neuralPlayback.audio.play();
    setSharedState({ isPaused: false });
    return;
  }
  if (speechStream) {
    setSharedState({ isPaused: false });
    if (!speechStream.busy) {
      playNextInStream();
      return;
    }
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.resume();
  }
}

export function useSpeechSynthesis(
  options: UseSpeechSynthesisOptions = {},
): UseSpeechSynthesisReturn {
  const { locale } = options;
  const [isSupported, setIsSupported] = useState(false);
  const [neuralAvailable, setNeuralAvailable] = useState(false);

  const { isSpeaking, isPaused } = useSyncExternalStore(
    subscribeShared,
    getSharedSnapshot,
    getServerSnapshot,
  );

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

  const speakFn = useCallback(
    (text: string) => speak(text, locale, neuralAvailable),
    [locale, neuralAvailable],
  );
  const startStreamFn = useCallback(
    () => startStream(locale, neuralAvailable),
    [locale, neuralAvailable],
  );
  const appendToStreamFn = useCallback((text: string) => appendToStream(text), []);
  const endStreamFn = useCallback(() => endStream(), []);
  const stopFn = useCallback(() => stopAll(), []);
  const pauseFn = useCallback(() => pauseAll(), []);
  const resumeFn = useCallback(() => resumeAll(), []);

  // Stops whatever is actually playing when a screen using read-aloud is
  // left — e.g. navigating away from Moment Coach mid-response. Only the
  // LAST instance to unmount triggers this (see mountedInstanceCount above)
  // — otherwise a SpeakButton mounting/unmounting as a new section streams
  // in would cancel an unrelated in-flight request from another instance.
  useEffect(() => {
    mountedInstanceCount += 1;
    return () => {
      mountedInstanceCount -= 1;
      if (mountedInstanceCount <= 0) {
        stopAll();
      }
    };
  }, []);

  return {
    speak: speakFn,
    startStream: startStreamFn,
    appendToStream: appendToStreamFn,
    endStream: endStreamFn,
    stop: stopFn,
    pause: pauseFn,
    resume: resumeFn,
    isSpeaking,
    isPaused,
    isSupported,
    canSpeak: isSupported || neuralAvailable,
  };
}
