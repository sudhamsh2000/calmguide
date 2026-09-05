import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import * as Speech from 'expo-speech';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { deleteSpeechFile, getSpeechStatus, synthesizeSpeechToFile } from '@/lib/api';

interface UseSpeechSynthesisOptions {
  locale?: string;
}

interface UseSpeechSynthesisReturn {
  speak: (text: string) => void;
  stop: () => void;
  isSpeaking: boolean;
}

/**
 * Module-level playback state, shared by every component using this hook.
 *
 * Only one thing can audibly play at a time, but each call site (a
 * per-message speaker button, plus the screen-level auto-speak-on-reply
 * effect) used to keep its own private `isSpeaking` state and its own
 * private player ref. That meant a speaker button had no way to know
 * *some other* instance had started playback: tapping it saw its own
 * `isSpeaking === false` and started a second, overlapping read instead of
 * stopping the first, and leaving the screen only tore down whichever
 * instance happened to unmount — not whatever was actually still playing.
 * Hoisting the live state here gives every instance the same view of
 * what's really happening, and lets any of them stop it.
 */
let sharedIsSpeaking = false;
const listeners = new Set<() => void>();

function setSharedIsSpeaking(value: boolean) {
  if (sharedIsSpeaking === value) return;
  sharedIsSpeaking = value;
  listeners.forEach((listener) => listener());
}

function subscribeShared(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSharedSnapshot(): boolean {
  return sharedIsSpeaking;
}

// Active neural playback: the player plus the cache file backing it, so both
// can be torn down together.
let activePlayer: { player: AudioPlayer; uri: string } | null = null;
// Guards out-of-order responses — if the caregiver stops or presses again
// while synthesis is in flight, the stale audio must not start playing.
let activeRequestId = 0;

/** Tear down any neural playback and remove its cache file. */
function stopNeural() {
  const current = activePlayer;
  if (!current) return;
  activePlayer = null;
  try {
    current.player.remove();
  } catch {
    // Already released.
  }
  deleteSpeechFile(current.uri);
}

function stopAll() {
  activeRequestId += 1; // invalidate anything still synthesizing
  stopNeural();
  Speech.stop();
  setSharedIsSpeaking(false);
}

/** Device voice. Always available, and the fallback for every failure. */
function speakLocal(text: string, locale?: string) {
  Speech.stop();
  Speech.speak(text, {
    language: locale,
    onStart: () => setSharedIsSpeaking(true),
    onDone: () => setSharedIsSpeaking(false),
    onStopped: () => setSharedIsSpeaking(false),
    onError: () => setSharedIsSpeaking(false),
  });
}

function speak(text: string, locale: string | undefined, neuralAvailable: boolean) {
  stopAll();
  const requestId = activeRequestId;

  if (!neuralAvailable) {
    speakLocal(text, locale);
    return;
  }

  // Marked speaking immediately rather than on playback start: synthesis
  // takes a moment, and a button that does nothing for two seconds reads as
  // broken.
  setSharedIsSpeaking(true);
  synthesizeSpeechToFile(text)
    .then((uri) => {
      // Superseded by a newer press, or stopped while synthesizing.
      if (requestId !== activeRequestId) {
        if (uri) deleteSpeechFile(uri);
        return;
      }
      if (!uri) {
        setSharedIsSpeaking(false);
        speakLocal(text, locale);
        return;
      }

      try {
        const player = createAudioPlayer(uri);
        activePlayer = { player, uri };
        player.addListener('playbackStatusUpdate', (status) => {
          if (status.didJustFinish) {
            setSharedIsSpeaking(false);
            stopNeural();
          }
        });
        player.play();
      } catch {
        // Synthesis succeeded but playback could not start; still better to
        // read it aloud badly than not at all.
        setSharedIsSpeaking(false);
        stopNeural();
        speakLocal(text, locale);
      }
    })
    .catch(() => {
      if (requestId !== activeRequestId) return;
      setSharedIsSpeaking(false);
      speakLocal(text, locale);
    });
}

/**
 * Read-aloud, preferring the server's neural voice and falling back to the
 * device's own.
 *
 * expo-speech uses whatever TTS engine the handset ships with, which is the
 * flat, clipped delivery this product spent a lot of effort getting away from
 * on the web — see backend/app/services/speech.py. The same endpoint serves
 * both platforms, so mobile gets the same warm voice as the browser instead of
 * whatever Samsung or Google installed.
 *
 * Failure always degrades to the device voice rather than to silence: read-aloud
 * exists for a caregiver who is too overwhelmed to read, so a flat voice beats
 * no voice.
 */
export function useSpeechSynthesis(
  options: UseSpeechSynthesisOptions = {},
): UseSpeechSynthesisReturn {
  const { locale } = options;
  const [neuralAvailable, setNeuralAvailable] = useState(false);
  const isSpeaking = useSyncExternalStore(subscribeShared, getSharedSnapshot, () => false);

  useEffect(() => {
    let cancelled = false;
    getSpeechStatus().then((ok) => {
      if (!cancelled) setNeuralAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Read-aloud is the whole point of pressing the button, so it should be
    // audible even with the ringer switched off — a caregiver at 3am is very
    // likely to have the phone silenced.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {
      // Non-fatal: playback still works, just not while muted.
    });
  }, []);

  const speakFn = useCallback(
    (text: string) => speak(text, locale, neuralAvailable),
    [locale, neuralAvailable],
  );
  const stopFn = useCallback(() => stopAll(), []);

  // Stops whatever is actually playing when a screen using read-aloud is
  // left. Safe to run from every instance's unmount (multiple instances on
  // one screen all unmount together on navigation): stopAll() is
  // idempotent, and it always targets the one real shared playback rather
  // than a possibly-empty local ref.
  useEffect(() => {
    return () => {
      stopAll();
    };
  }, []);

  return { speak: speakFn, stop: stopFn, isSpeaking };
}
