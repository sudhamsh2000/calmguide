'use client';

import { useState, useCallback, useRef, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { MicButton } from '@/components/ui/MicButton';

const MAX_CHARS = 500;

export interface CoachInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  buttonLabel?: string;
  className?: string;
}

export function CoachInput({
  onSubmit,
  disabled = false,
  placeholder,
  buttonLabel,
  className = '',
}: CoachInputProps) {
  const t = useTranslations('coach');
  const tc = useTranslations('common');
  const resolvedPlaceholder = placeholder ?? t('input_placeholder');
  const resolvedButtonLabel = buttonLabel ?? t('submit_button');
  const [text, setText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setText('');
  }, [text, onSubmit, disabled]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== 'Enter') return;
      // Shift+Enter inserts a newline. Ignore keystrokes that are part of an
      // IME composition so CJK input is not sent prematurely.
      if (e.shiftKey || e.nativeEvent.isComposing || e.keyCode === 229) return;
      // Plain Enter and Ctrl/Cmd+Enter both submit.
      e.preventDefault();
      handleSubmit();
    },
    [handleSubmit],
  );

  const handleVoiceTranscript = useCallback((transcript: string) => {
    setInterimText('');
    setText((prev) => {
      const updated = prev + (prev ? ' ' : '') + transcript;
      return updated.slice(0, MAX_CHARS + 50);
    });
  }, []);

  const handleInterim = useCallback((transcript: string) => {
    setInterimText(transcript);
  }, []);

  const handleListeningChange = useCallback((listening: boolean) => {
    setIsListening(listening);
    if (!listening) setInterimText('');
  }, []);

  const charCount = text.length;
  const isOverLimit = charCount > MAX_CHARS;
  const canSubmit = !disabled && charCount > 0 && !isOverLimit && text.trim().length > 0;

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS + 50))}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={isListening ? '' : resolvedPlaceholder}
          rows={4}
          aria-label={t('input_aria_label')}
          className={[
            'field-shell w-full px-4 py-3 pb-10 text-coach transition-all resize-none',
            'min-h-[120px]',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
            isListening ? 'field-shell-error' : isOverLimit ? 'field-shell-error' : '',
          ].join(' ')}
        />
        {/* Interim speech text shown live as user speaks */}
        {isListening && interimText && (
          <div
            className="absolute top-3 start-4 end-4 pointer-events-none"
            style={{ top: text ? undefined : '0.75rem' }}
          >
            {text && <div className="h-[calc(1.5em*4)]" />}
            <p className="text-coach text-foreground-muted/50 italic">{interimText}</p>
          </div>
        )}
        {/* "Speak now" prompt when listening with empty input and no interim */}
        {isListening && !text && !interimText && (
          <div className="absolute top-3 start-4 end-4 pointer-events-none">
            <p className="text-coach text-error/60 animate-pulse">{tc('actions.speak_now')}</p>
          </div>
        )}
        {/* Bottom bar: char count, listening indicator, mic */}
        <div className="absolute bottom-2 start-3 end-2 flex items-center justify-between">
          <span
            className={`text-sm ${
              isOverLimit ? 'text-error font-semibold' : 'text-foreground-muted'
            }`}
            aria-live="polite"
          >
            {charCount} / {MAX_CHARS}
          </span>
          <div className="flex items-center gap-2">
            {isListening && (
              <div className="flex items-center gap-1.5 text-error" aria-live="polite">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error/75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-error" />
                </span>
                <span className="text-xs font-medium">{tc('accessibility.listening')}</span>
              </div>
            )}
            <MicButton
              onTranscript={handleVoiceTranscript}
              onInterim={handleInterim}
              onListeningChange={handleListeningChange}
              onSpeechEnd={handleSubmit}
              disabled={disabled}
            />
          </div>
        </div>
      </div>
      <Button
        size="lg"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full min-h-tap text-lg font-semibold"
      >
        {resolvedButtonLabel}
      </Button>
      <p className="text-sm text-foreground-muted text-center leading-relaxed">
        {tc('privacy_hint')}
      </p>
    </div>
  );
}
