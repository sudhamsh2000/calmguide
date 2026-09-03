'use client';

import { useState, useCallback, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { MicButton } from '@/components/ui/MicButton';

const MAX_CHARS = 500;

export interface CoachFooterInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

export function CoachFooterInput({ onSubmit, disabled = false }: CoachFooterInputProps) {
  const t = useTranslations('coach');
  const tc = useTranslations('common');
  const [text, setText] = useState('');

  const canSubmit = !disabled && text.trim().length > 0 && text.length <= MAX_CHARS;

  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');

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
      // IME composition (e.g. selecting a candidate) so CJK input is not sent
      // prematurely.
      if (e.shiftKey || e.nativeEvent.isComposing || e.keyCode === 229) return;
      // Plain Enter and Ctrl/Cmd+Enter both submit.
      e.preventDefault();
      if (!canSubmit) return;
      handleSubmit();
    },
    [handleSubmit, canSubmit],
  );

  return (
    <div
      className={[
        'flex items-end gap-1 rounded-xl border px-2 py-1.5 transition-all bg-surface',
        isListening
          ? 'field-shell-error'
          : disabled
            ? 'opacity-50 border-slate-300 dark:border-[#31445f]'
            : 'border-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_1px_2px_rgba(23,37,42,0.06)] hover:border-slate-400 dark:border-[#31445f] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_0_0_1px_rgba(26,35,50,0.14)] dark:hover:border-[#3a4f6d] focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(58,175,169,0.18)] dark:focus-within:border-[#57c7c2] dark:focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(87,199,194,0.38),0_0_0_4px_rgba(43,122,120,0.16)]',
      ].join(' ')}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS + 50))}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={
          isListening && !text ? interimText || tc('actions.speak_now') : t('followup_placeholder')
        }
        rows={1}
        aria-label={t('followup_aria_label')}
        className={[
          'flex-1 resize-none bg-transparent px-2 py-1.5 text-base',
          'text-foreground placeholder:text-foreground-muted/60',
          'focus:outline-none',
          'max-h-28 overflow-y-auto',
          disabled ? 'cursor-not-allowed' : '',
        ].join(' ')}
      />
      <MicButton
        onTranscript={handleVoiceTranscript}
        onInterim={handleInterim}
        onListeningChange={handleListeningChange}
        onSpeechEnd={handleSubmit}
        disabled={disabled}
        className="shrink-0"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        aria-label={tc('actions.send')}
        className={[
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
          canSubmit
            ? 'bg-primary text-white hover:bg-primary-dark'
            : 'text-foreground-muted cursor-not-allowed',
        ].join(' ')}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M22 2L11 13" />
          <path d="M22 2L15 22l-4-9-9-4 20-7z" />
        </svg>
      </button>
    </div>
  );
}
