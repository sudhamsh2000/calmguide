"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface UseSpeechRecognitionOptions {
  locale?: string;
  onResult?: (transcript: string) => void;
  onInterim?: (transcript: string) => void;
}

const LOCALE_TO_BCP47: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  hi: "hi-IN",
};

interface UseSpeechRecognitionReturn {
  start: () => void;
  stop: () => void;
  isListening: boolean;
  isSupported: boolean;
}

function getSpeechRecognitionConstructor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as { SpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition ??
    null
  );
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn {
  const { locale, onResult, onInterim } = options;
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onResultRef = useRef(onResult);
  const onInterimRef = useRef(onInterim);

  onResultRef.current = onResult;
  onInterimRef.current = onInterim;

  useEffect(() => {
    setIsSupported(getSpeechRecognitionConstructor() !== null);
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) return;

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    if (locale) recognition.lang = LOCALE_TO_BCP47[locale] ?? locale;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        onResultRef.current?.(finalTranscript);
      }
      if (interimTranscript) {
        onInterimRef.current?.(interimTranscript);
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
    setIsListening(true);
  }, [locale]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  return { start, stop, isListening, isSupported };
}
