'use client';

import { useCallback } from 'react';
import { useLocale } from 'next-intl';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

export interface MicButtonProps {
  onTranscript: (text: string) => void;
  onInterim?: (text: string) => void;
  onListeningChange?: (isListening: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function MicButton({
  onTranscript,
  onInterim,
  onListeningChange,
  disabled = false,
  className = '',
}: MicButtonProps) {
  const locale = useLocale();
  const { start, stop, isListening, isSupported } = useSpeechRecognition({
    locale,
    onResult: onTranscript,
    onInterim,
  });

  const handleClick = useCallback(() => {
    if (isListening) {
      stop();
      onListeningChange?.(false);
      onInterim?.('');
    } else {
      start();
      onListeningChange?.(true);
    }
  }, [isListening, start, stop, onListeningChange, onInterim]);

  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={isListening ? 'Stop voice input' : 'Voice input'}
      className={`inline-flex items-center justify-center h-9 w-9 rounded-lg transition-colors ${
        isListening
          ? 'bg-error/15 text-error'
          : 'text-foreground-muted/50 hover:text-foreground-muted hover:bg-foreground/10'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {isListening ? (
        <span className="relative flex h-5 w-5 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error/30" />
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          </svg>
        </span>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      )}
    </button>
  );
}
