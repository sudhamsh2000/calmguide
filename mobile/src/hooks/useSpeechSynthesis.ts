import { useState, useCallback, useEffect, useRef } from 'react';
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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [neuralAvailable, setNeuralAvailable] = useState(false);

  // Active neural playback: the player plus the cache file backing it, so both
  // can be torn down together.
  const playerRef = useRef<{ player: AudioPlayer; uri: string } | null>(null);
  // Guards out-of-order responses — if the caregiver stops or presses again
  // while synthesis is in flight, the stale audio must not start playing.
  const requestIdRef = useRef(0);

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

  /** Tear down any neural playback and remove its cache file. */
  const stopNeural = useCallback(() => {
    const current = playerRef.current;
    if (!current) return;
    playerRef.current = null;
    try {
      current.player.remove();
    } catch {
      // Already released.
    }
    deleteSpeechFile(current.uri);
  }, []);

  const stop = useCallback(() => {
    requestIdRef.current += 1; // invalidate anything still synthesizing
    stopNeural();
    Speech.stop();
    setIsSpeaking(false);
  }, [stopNeural]);

  /** Device voice. Always available, and the fallback for every failure. */
  const speakLocal = useCallback(
    (text: string) => {
      Speech.stop();
      Speech.speak(text, {
        language: locale,
        onStart: () => setIsSpeaking(true),
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    },
    [locale],
  );

  const speak = useCallback(
    (text: string) => {
      stop();
      const requestId = requestIdRef.current;

      if (!neuralAvailable) {
        speakLocal(text);
        return;
      }

      // Marked speaking immediately rather than on playback start: synthesis
      // takes a moment, and a button that does nothing for two seconds reads as
      // broken.
      setIsSpeaking(true);
      synthesizeSpeechToFile(text)
        .then((uri) => {
          // Superseded by a newer press, or stopped while synthesizing.
          if (requestId !== requestIdRef.current) {
            if (uri) deleteSpeechFile(uri);
            return;
          }
          if (!uri) {
            setIsSpeaking(false);
            speakLocal(text);
            return;
          }

          try {
            const player = createAudioPlayer(uri);
            playerRef.current = { player, uri };
            player.addListener('playbackStatusUpdate', (status) => {
              if (status.didJustFinish) {
                setIsSpeaking(false);
                stopNeural();
              }
            });
            player.play();
          } catch {
            // Synthesis succeeded but playback could not start; still better to
            // read it aloud badly than not at all.
            setIsSpeaking(false);
            stopNeural();
            speakLocal(text);
          }
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) return;
          setIsSpeaking(false);
          speakLocal(text);
        });
    },
    [neuralAvailable, speakLocal, stop, stopNeural],
  );

  useEffect(() => {
    return () => {
      stopNeural();
      Speech.stop();
    };
  }, [stopNeural]);

  return { speak, stop, isSpeaking };
}
