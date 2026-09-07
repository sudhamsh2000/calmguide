import { useState, useCallback, useRef } from 'react';

let ExpoSpeechRecognitionModule: {
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  start: (options: { lang: string; interimResults: boolean; continuous: boolean }) => void;
  stop: () => void;
} | null = null;

let useSpeechRecognitionEvent: ((event: string, handler: (e: unknown) => void) => void) | null =
  null;

try {
  const mod = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = mod.useSpeechRecognitionEvent;
} catch {
  // expo-speech-recognition not available (Expo Go or missing native module)
}

interface UseSpeechRecognitionOptions {
  locale?: string;
  onResult?: (transcript: string) => void;
  /**
   * Fired whenever recognition fails to produce a transcript, including a
   * denied permission. Without this, the only visible symptom was the mic
   * icon flashing to "listening" and silently reverting a moment later — on
   * a real device that happens for perfectly ordinary reasons (no network,
   * a busy recognition service, a revoked permission), not just on an
   * emulator without a recognizer installed, so it needed surfacing rather
   * than being swallowed.
   */
  onError?: (code: string) => void;
  /**
   * Fired when recognition actually finishes — after any trailing final
   * `onResult` for the last utterance. Use this (not the listening-state
   * flip) to auto-submit on "done speaking": `stop()`/the listening state
   * change happens the instant the mic button is pressed, before the
   * recognizer delivers that last transcript, so acting on it directly would
   * submit whatever was transcribed a moment too early. Mirrors the web
   * hook's `onEnd` (frontend/src/hooks/useSpeechRecognition.ts).
   */
  onEnd?: () => void;
}

interface UseSpeechRecognitionReturn {
  start: () => void;
  stop: () => void;
  isListening: boolean;
  isSupported: boolean;
}

// No-op event hook when module is unavailable
const noopEventHook = (_event: string, _handler: (e: unknown) => void) => {};

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn {
  const { locale, onResult, onError, onEnd } = options;
  const [isListening, setIsListening] = useState(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const useEvent = useSpeechRecognitionEvent ?? noopEventHook;

  useEvent('result', (event: unknown) => {
    const e = event as { results?: { transcript?: string }[]; isFinal?: boolean };
    const transcript = e.results?.[0]?.transcript;
    if (transcript && e.isFinal) {
      onResultRef.current?.(transcript);
    }
  });

  useEvent('end', () => {
    setIsListening(false);
    onEndRef.current?.();
  });
  useEvent('error', (event: unknown) => {
    setIsListening(false);
    const e = event as { error?: string };
    onErrorRef.current?.(e.error ?? 'unknown');
  });

  const start = useCallback(async () => {
    if (!ExpoSpeechRecognitionModule) return;
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      onErrorRef.current?.('not-allowed');
      return;
    }

    ExpoSpeechRecognitionModule.start({
      lang: locale ?? 'en-US',
      interimResults: true,
      continuous: true,
    });
    setIsListening(true);
  }, [locale]);

  const stop = useCallback(() => {
    if (!ExpoSpeechRecognitionModule) return;
    ExpoSpeechRecognitionModule.stop();
    setIsListening(false);
  }, []);

  return { start, stop, isListening, isSupported: ExpoSpeechRecognitionModule !== null };
}
