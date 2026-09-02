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
  const { locale, onResult } = options;
  const [isListening, setIsListening] = useState(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const useEvent = useSpeechRecognitionEvent ?? noopEventHook;

  useEvent('result', (event: unknown) => {
    const e = event as { results?: { transcript?: string }[]; isFinal?: boolean };
    const transcript = e.results?.[0]?.transcript;
    if (transcript && e.isFinal) {
      onResultRef.current?.(transcript);
    }
  });

  useEvent('end', () => setIsListening(false));
  useEvent('error', () => setIsListening(false));

  const start = useCallback(async () => {
    if (!ExpoSpeechRecognitionModule) return;
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) return;

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
