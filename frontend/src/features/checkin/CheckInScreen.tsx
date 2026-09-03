'use client';

import { Link } from '@/i18n/navigation';
import { useState, useCallback, useRef } from 'react';

const CHECKIN_MAX_CHARS = 1000;
import { useLocale, useTranslations } from 'next-intl';
import { checkIn, ApiError } from '@/lib/api';
import { getAccessCode, getAutoSpeakReplies } from '@/lib/storage';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { SpeakButton } from '@/components/ui/SpeakButton';
import { MicButton } from '@/components/ui/MicButton';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';

export function CheckInScreen() {
  const t = useTranslations('checkin');
  const tc = useTranslations('common');
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isOnline } = useNetworkStatus();
  const locale = useLocale();
  const { speak } = useSpeechSynthesis({ locale });
  // Read in the (stable) submit callback below without adding isOnline to
  // its dependency array — mirrors the pattern in useStreamingChat.ts.
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;

  const [isVoiceListening, setIsVoiceListening] = useState(false);

  const handleVoiceTranscript = useCallback((transcript: string) => {
    setMessage((prev) => prev + (prev ? ' ' : '') + transcript);
  }, []);

  const handleListeningChange = useCallback((listening: boolean) => {
    setIsVoiceListening(listening);
  }, []);

  const handleSubmit = useCallback(async () => {
    const accessCode = getAccessCode();
    if (!accessCode || !message.trim()) return;

    setResponse('');
    setIsDone(false);
    setError(null);
    setIsStreaming(true);

    try {
      const stream = await checkIn(accessCode, message.trim());
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data) as { text?: string; replace?: string };
            if (parsed.replace) {
              accumulated = parsed.replace;
              setResponse(accumulated);
            } else if (parsed.text) {
              accumulated += parsed.text;
              setResponse(accumulated);
            }
          } catch {
            // skip malformed
          }
        }
      }
      setIsDone(true);
      if (getAutoSpeakReplies() && accumulated.trim()) {
        speak(accumulated);
      }
    } catch (err) {
      if (isOnlineRef.current === false) {
        // Known offline — distinct copy so the caregiver knows retrying
        // won't help until connectivity is back (P2-12).
        setError(tc('network.offline_detail'));
      } else if (err instanceof ApiError) {
        setError(tc('error.generic'));
      } else {
        setError(tc('error.connection'));
      }
    } finally {
      setIsStreaming(false);
    }
  }, [message, speak]);

  return (
    <div className="flex flex-col gap-5 px-5 pt-5 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BackButton href="/home" label={tc('nav.back_to_home')} />
        <div>
          <h1
            className="text-xl font-medium text-foreground leading-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('title')}
          </h1>
          <p className="text-sm text-foreground-muted mt-0.5">{t('subtitle')}</p>
        </div>
      </div>

      <OfflineBanner />

      {/* Input area — hide after first submission */}
      {!isDone && !isStreaming && !response && (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, CHECKIN_MAX_CHARS + 50))}
              placeholder={isVoiceListening ? '' : t('input_placeholder')}
              rows={5}
              aria-label={t('input_aria_label')}
              maxLength={CHECKIN_MAX_CHARS + 50}
              className={[
                'field-shell w-full px-4 py-3 pb-10 text-base transition-all resize-none',
                'min-h-[140px]',
                isVoiceListening ? 'field-shell-error' : '',
              ].join(' ')}
            />
            {isVoiceListening && !message && (
              <div className="absolute top-3 start-4 end-4 pointer-events-none">
                <p className="text-base text-error/60 animate-pulse">{tc('actions.speak_now')}</p>
              </div>
            )}
            <div className="absolute bottom-2 end-2 flex items-center gap-2">
              {isVoiceListening && (
                <div className="flex items-center gap-1.5 text-error" aria-live="polite">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error/75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-error" />
                  </span>
                  <span className="text-xs font-medium">{tc('actions.speak_now')}</span>
                </div>
              )}
              <MicButton
                onTranscript={handleVoiceTranscript}
                onListeningChange={handleListeningChange}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <span
              className={`text-xs ${
                message.length > CHECKIN_MAX_CHARS
                  ? 'text-error font-semibold'
                  : 'text-foreground-muted'
              }`}
              aria-live="polite"
            >
              {message.length} / {CHECKIN_MAX_CHARS}
            </span>
          </div>
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={!message.trim() || message.length > CHECKIN_MAX_CHARS}
            className="w-full min-h-tap text-lg font-semibold"
          >
            {t('submit_button')}
          </Button>
        </div>
      )}

      {/* Streaming / loading state */}
      {isStreaming && !response && (
        <div className="flex items-center gap-3 py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-foreground-muted">{t('loading')}</p>
        </div>
      )}

      {/* Streamed response */}
      {response && (
        <div className="rounded-2xl border border-foreground/10 bg-surface px-5 py-5">
          <div className="flex justify-end mb-2">
            <SpeakButton text={response} />
          </div>
          <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap">
            {response}
          </p>
        </div>
      )}

      {/* Done state — option to go back */}
      {isDone && (
        <Link
          href="/home"
          className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-6 h-12 text-lg font-semibold text-white transition-colors hover:bg-primary-light active:bg-primary-dark focus-ring"
        >
          {tc('nav.back_to_home')}
        </Link>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-xl bg-error/10 border border-error/30 p-4" role="alert">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}
    </div>
  );
}
