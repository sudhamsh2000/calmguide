'use client';

import { useState, useCallback, useRef, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { CoachInput } from '@/features/coach/CoachInput';
import { CoachFooterInput } from '@/features/coach/CoachFooterInput';
import { CoachResponseRenderer } from '@/features/coach/CoachResponseRenderer';
import { parseCoachResponse } from '@/features/coach/parseResponse';
import { useStreamingChat } from '@/features/coach/useStreamingChat';
import { formatResidentLocation } from '@/lib/facility-utils';
import { BreathingIndicator } from '@/components/ui/BreathingIndicator';
import { EmergencyAlert } from '@/components/ui/EmergencyAlert';
import { BackButton } from '@/components/ui/BackButton';
import { SafetyDisclosure } from '@/components/ui/SafetyDisclosure';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { ResidentContextBanner } from '@/components/facility/ResidentContextBanner';
import { FacilityModeShell } from '@/components/facility/FacilityModeShell';
import { MedicalDisclaimer } from '@/components/ui/MedicalDisclaimer';
import { getConversationMessages, getSessionFeedback } from '@/lib/api';
import type { FeedbackEntry } from '@/lib/api';
import { getAccessCode, getAutoSpeakReplies } from '@/lib/storage';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import type { CoachSection } from '@/features/coach/parseResponse';

interface ChatExchange {
  userMessage: string;
  response: string;
  sections: CoachSection[];
}

function GreetingCard() {
  const t = useTranslations('coach');
  return (
    <div className="mb-3 rounded-2xl bg-primary/5 border border-primary/20 p-3">
      <p className="text-base text-foreground leading-snug">
        {t('greeting')} <span className="text-foreground-muted">{t('greeting_detail')}</span>
      </p>
    </div>
  );
}

function UserMessageBubble({ message }: { message: string }) {
  const t = useTranslations('coach');
  return (
    <div className="mb-4 max-w-3xl rounded-2xl border border-foreground/10 bg-surface/80 px-4 py-3.5 shadow-[0_1px_2px_rgba(23,37,42,0.05)] dark:border-theme-soft dark:bg-surface/70 dark:shadow-[0_1px_2px_rgba(0,0,0,0.18)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-muted mb-1.5">
        {t('you_asked')}
      </p>
      <p className="text-coach text-foreground leading-relaxed">{message}</p>
    </div>
  );
}

function CoachPageInner() {
  const t = useTranslations('coach');
  const tc = useTranslations('common');
  const searchParams = useSearchParams();
  const initialSessionId = searchParams.get('session_id') ?? undefined;
  const profileId = searchParams.get('profile_id');
  const unit = searchParams.get('unit');
  const room = searchParams.get('room');
  const bed = searchParams.get('bed');
  const risk = (searchParams.get('risk') ?? 'low') as 'high' | 'moderate' | 'low';
  const isFacilityMode = !!profileId;
  const residentName = isFacilityMode ? formatResidentLocation(unit, room, bed) : undefined;

  const { response, isStreaming, error, emergency, sendMessage, clearError, clearEmergency } =
    useStreamingChat(
      initialSessionId,
      profileId ?? undefined,
      residentName,
    );
  const locale = useLocale();
  const { speak } = useSpeechSynthesis({ locale });
  const [history, setHistory] = useState<ChatExchange[]>([]);
  const [currentMessage, setCurrentMessage] = useState<string | null>(null);
  const [showInitial, setShowInitial] = useState(!initialSessionId);
  const [loadingHistory, setLoadingHistory] = useState(!!initialSessionId);
  const [sessionFeedback, setSessionFeedback] = useState<Record<string, FeedbackEntry>>({});

  const backHref = isFacilityMode
    ? `/facility/residents/${profileId}?${new URLSearchParams(
        Object.entries({ unit, room, bed }).filter(([, v]) => v != null) as [string, string][],
      ).toString()}`
    : '/home';
  const backLabel = isFacilityMode ? tc('nav.back') : tc('nav.back_to_home');

  // Flag that coach was visited this session (suppresses home feedback card)
  useEffect(() => {
    sessionStorage.setItem('calmguide_visited_coach', 'true');
  }, []);

  // Load past messages when resuming a session from the home screen
  useEffect(() => {
    if (!initialSessionId) return;
    const accessCode = getAccessCode();
    if (!accessCode) {
      setLoadingHistory(false);
      return;
    }
    getConversationMessages(accessCode, initialSessionId)
      .then((messages) => {
        const exchanges: ChatExchange[] = [];
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          if (msg.role === 'user') {
            const next = messages[i + 1];
            if (next?.role === 'assistant') {
              exchanges.push({
                userMessage: msg.content,
                response: next.content,
                sections: parseCoachResponse(next.content),
              });
              i++; // skip the assistant message we just consumed
            }
            // If no matching assistant message, skip — incomplete exchange
          }
        }
        setHistory(exchanges);
        // Fetch existing feedback for this session
        if (accessCode) {
          getSessionFeedback(accessCode, initialSessionId)
            .then((entries) => {
              const map: Record<string, FeedbackEntry> = {};
              for (const entry of entries) {
                map[entry.conversation_id] = entry;
              }
              setSessionFeedback(map);
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        // Failed to load — still show the chat in Phase 2 for continuation
      })
      .finally(() => {
        setLoadingHistory(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Memoize parsing so the streamed response is only re-parsed when the text
  // actually changes, not on every unrelated re-render.
  const currentSections = useMemo(() => parseCoachResponse(response), [response]);

  // Archive exchange into history when streaming completes. Gated on the
  // "streaming just transitioned to done" edge, so this fires exactly once
  // per live response and never replays when history is loaded or
  // re-rendered.
  const prevStreamingRef = useRef(isStreaming);
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming && response && currentMessage) {
      setHistory((prev) => [
        ...prev,
        {
          userMessage: currentMessage,
          response,
          sections: parseCoachResponse(response),
        },
      ]);
      setCurrentMessage(null);
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming, response, currentMessage]);

  // Auto-speak (Profile settings toggle): read "Right Now" — the first,
  // most urgent section — aloud as soon as ITS text is done streaming,
  // rather than waiting for the full multi-section response to finish and
  // then synthesizing the whole thing in one request. That old approach
  // meant LLM generation time (several seconds) plus TTS synthesis of the
  // entire response (measured ~11.7ms/char, so 10s+ for a realistic
  // multi-section reply) both had to finish before any audio started — a
  // caregiver could wait 20-30+ seconds in silence. "Right Now" is
  // typically the shortest section and available earliest in the stream,
  // so speaking just it gets audio guidance started in a few seconds. The
  // rest of the response keeps streaming in visually and stays readable —
  // and separately speakable — via each section's own speak button
  // (CoachResponseRenderer), same as before.
  const spokenFirstSectionRef = useRef(false);
  useEffect(() => {
    spokenFirstSectionRef.current = false;
  }, [currentMessage]);
  useEffect(() => {
    if (spokenFirstSectionRef.current || !currentMessage || !getAutoSpeakReplies()) return;
    const first = currentSections[0];
    if (!first || !first.content.trim()) return;
    // "Right Now" is done streaming once a second section's marker has
    // appeared (proof the backend moved on), or the whole response ended
    // with only one section total.
    const firstSectionComplete = currentSections.length > 1 || !isStreaming;
    if (!firstSectionComplete) return;
    spokenFirstSectionRef.current = true;
    speak(first.content);
  }, [currentSections, isStreaming, currentMessage, speak]);

  const handleSendMessage = useCallback(
    (message: string) => {
      clearError();
      setCurrentMessage(message);
      setShowInitial(false);
      sendMessage(message);
    },
    [sendMessage, clearError],
  );

  const handleRetry = useCallback(() => {
    if (currentMessage) {
      clearError();
      sendMessage(currentMessage);
    }
  }, [currentMessage, sendMessage, clearError]);

  // ── Loading history ───────────────────────────────────────────────────────
  if (loadingHistory) {
    return (
      <main className="flex flex-col h-full items-center justify-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-foreground-muted">{t('loading_conversation')}</p>
      </main>
    );
  }

  // ── Phase 1: Initial input ────────────────────────────────────────────────
  if (showInitial) {
    return (
      <main className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <header className="mb-3">
            <div className="flex items-center gap-3">
              <BackButton href={backHref} label={backLabel} />
              <h1
                className="text-xl font-medium text-foreground"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {t('title')}
              </h1>
            </div>
          </header>

          {isFacilityMode && (
            <ResidentContextBanner unit={unit} room={room} bed={bed} riskLevel={risk} />
          )}

          <div className={`mb-3 ${isFacilityMode ? 'mt-4' : ''}`}>
            <SafetyDisclosure />
          </div>

          <div className="empty:hidden [&:not(:empty)]:mb-3">
            <OfflineBanner />
          </div>

          <GreetingCard />

          <CoachInput onSubmit={handleSendMessage} disabled={isStreaming} />
        </div>
      </main>
    );
  }

  // ── Phase 2: Chat layout ──────────────────────────────────────────────────
  return (
    <main className="flex flex-col h-full">
      {/* Portalled to document.body, so it sits above this screen's own
       * stacking contexts rather than inside them. */}
      <EmergencyAlert open={emergency} onDismiss={clearEmergency} />

      {/* Header — compact in Phase 2 to maximize chat space */}
      <header className="shrink-0 border-b border-foreground/10 px-5 py-2 space-y-2">
        <div className="flex items-center gap-3">
          <BackButton href={backHref} label={backLabel} />
          <h1
            className="text-lg font-medium text-foreground"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('title')}
          </h1>
          {isStreaming && (
            <span
              className="ms-1 h-2 w-2 rounded-full bg-primary animate-pulse"
              aria-label={tc('loading')}
            />
          )}
        </div>
        <SafetyDisclosure />
      </header>

      <div className="shrink-0 px-5 empty:hidden [&:not(:empty)]:pt-3">
        <OfflineBanner />
      </div>

      {isFacilityMode && (
        <ResidentContextBanner unit={unit} room={room} bed={bed} riskLevel={risk} />
      )}

      {/* Scrollable message thread */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {history.map((exchange, i) => (
          <div key={i}>
            <UserMessageBubble message={exchange.userMessage} />
            <CoachResponseRenderer sections={exchange.sections} rawResponse={exchange.response} />
          </div>
        ))}

        {currentMessage && (
          <div>
            <UserMessageBubble message={currentMessage} />

            {/*
              Live region: streamed guidance is announced to screen readers as it
              arrives. aria-live="polite" waits for pauses so it is not spammy;
              aria-atomic="false" announces only newly added text, not the whole
              block on every chunk. aria-busy reflects the streaming state.
            */}
            <div
              role="status"
              aria-live="polite"
              aria-atomic="false"
              aria-busy={isStreaming}
              aria-label={t('title')}
            >
              {isStreaming && currentSections.length === 0 && (
                <BreathingIndicator className="py-8" />
              )}

              {(currentSections.length > 0 || (!isStreaming && response)) && (
                <CoachResponseRenderer sections={currentSections} rawResponse={response} />
              )}

              {isStreaming && currentSections.length > 0 && (
                <div className="mt-4 flex items-center gap-2 text-foreground-muted">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                  <span className="text-sm">{t('still_working')}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-error/30 bg-error/5 p-5 text-center">
            <p className="text-coach text-foreground mb-4">{error}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-full bg-primary px-6 py-3 text-base font-semibold text-onPrimary hover:bg-primary-dark transition-colors"
            >
              {tc('actions.try_again')}
            </button>
          </div>
        )}
      </div>

      {/* Sticky footer input */}
      <div className="shrink-0 border-t border-foreground/10 bg-background px-4 py-3">
        <CoachFooterInput onSubmit={handleSendMessage} disabled={isStreaming} />
      </div>
    </main>
  );
}

function CoachPageContent() {
  return (
    <MedicalDisclaimer>
      <Suspense>
        <CoachPageInner />
      </Suspense>
    </MedicalDisclaimer>
  );
}

function FacilityDetector() {
  const searchParams = useSearchParams();
  const profileId = searchParams.get('profile_id');
  if (profileId) {
    return (
      <FacilityModeShell>
        <CoachPageContent />
      </FacilityModeShell>
    );
  }
  return <CoachPageContent />;
}

export default function CoachPage() {
  return (
    <Suspense>
      <FacilityDetector />
    </Suspense>
  );
}
