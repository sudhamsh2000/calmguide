import { useState, useCallback, useEffect } from 'react';
import * as Speech from 'expo-speech';

interface UseSpeechSynthesisOptions {
  locale?: string;
}

interface UseSpeechSynthesisReturn {
  speak: (text: string) => void;
  stop: () => void;
  isSpeaking: boolean;
}

export function useSpeechSynthesis(
  options: UseSpeechSynthesisOptions = {},
): UseSpeechSynthesisReturn {
  const { locale } = options;
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = useCallback(
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

  const stop = useCallback(() => {
    Speech.stop();
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  return { speak, stop, isSpeaking };
}
