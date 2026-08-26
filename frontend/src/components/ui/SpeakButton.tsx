"use client";

import { useCallback } from "react";
import { useLocale } from "next-intl";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";

export interface SpeakButtonProps {
  text: string;
  className?: string;
}

export function SpeakButton({ text, className = "" }: SpeakButtonProps) {
  const locale = useLocale();
  const { speak, stop, isSpeaking, isPaused, pause, resume, isSupported } =
    useSpeechSynthesis({ locale });

  const handleClick = useCallback(() => {
    if (isSpeaking && !isPaused) {
      pause();
    } else if (isPaused) {
      resume();
    } else {
      speak(text);
    }
  }, [isSpeaking, isPaused, speak, pause, resume, text]);

  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isSpeaking ? "Stop reading" : "Read aloud"}
      className={`inline-flex items-center justify-center h-8 w-8 rounded-lg transition-colors hover:bg-foreground/10 ${
        isSpeaking ? "text-primary" : "text-foreground-muted"
      } ${className}`}
    >
      {isSpeaking && !isPaused ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      )}
    </button>
  );
}
