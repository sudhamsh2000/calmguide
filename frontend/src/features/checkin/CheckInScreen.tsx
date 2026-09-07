'use client';

import { Link } from '@/i18n/navigation';
import { useState, useCallback, useRef, type ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';

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

const markdownComponents: ComponentProps<typeof ReactMarkdown>['components'] = {
  p: ({ children }) => (
    <p className="text-base leading-relaxed text-foreground mb-2 last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc ps-5 space-y-1 text-base text-foreground">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal ps-5 space-y-1 text-base text-foreground">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h2: ({ children }) => (
    <h2 className="font-semibold text-lg text-foreground mt-3 mb-1 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-semibold text-base text-foreground mt-3 mb-1 first:mt-0">{children}</h3>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-s-2 border-foreground/20 ps-3 text-foreground">
      {children}
    </blockquote>
  ),
};

// Defense-in-depth allowlist for LLM-rendered markdown, matching
// CoachResponseRenderer's — no img/a/embedded HTML, plus h2 since crisis
// escalation copy (checkin's other frequent response shape) opens with one.
const ALLOWED_MARKDOWN_ELEMENTS: ReadonlyArray<string> = [
  'p',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'h2',
  'h3',
  'br',
  'blockquote',
  'code',
  'pre',
];

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
    <div className="relative flex flex-col gap-5 px-5 pt-5 pb-8">
      {/* Decorative section glow (design/design.md §19) — one small, static
       * blob behind the header only, well clear of the textarea and the
       * streamed-response card (both sit on opaque surfaces), so nothing
       * reduces legibility of a caregiver's own words or the coach's reply. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="decor-blob decor-blob-mint -top-10 -end-16 h-56 w-56" />
      </div>

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
                onSpeechEnd={handleSubmit}
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
          <ReactMarkdown
            components={markdownComponents}
            allowedElements={ALLOWED_MARKDOWN_ELEMENTS}
            unwrapDisallowed
            skipHtml
          >
            {response}
          </ReactMarkdown>
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
