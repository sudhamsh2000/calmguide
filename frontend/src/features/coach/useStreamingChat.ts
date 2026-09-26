'use client';

import { useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { coachChat, ApiError, RequestTimeoutError } from '@/lib/api';
import { getAccessCode, getPatientName } from '@/lib/storage';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export interface StreamingChatState {
  /** The accumulated response text for the current message */
  response: string;
  /** Whether a stream is currently active */
  isStreaming: boolean;
  /** The session ID returned by the first API response */
  sessionId: string | null;
  /** Error message if the last request failed */
  error: string | null;
  /**
   * Set when the safety gate short-circuited this turn with an EMERGENCY
   * decision. The gate path used to stream the same `{text}` shape as an
   * ordinary answer, so the UI had no way to escalate its presentation.
   * HIGH (acute change) deliberately does not set this — urgent, but not a
   * 911 prompt.
   */
  emergency: boolean;
}

export interface UseStreamingChatReturn extends StreamingChatState {
  /** Send a message and begin streaming the response */
  sendMessage: (message: string) => void;
  /** Clear the current error */
  clearError: () => void;
  /** Dismiss the emergency alert without clearing the response text */
  clearEmergency: () => void;
}

/**
 * Custom hook that manages streaming chat communication with the coach API.
 * Parses SSE events from a ReadableStream and accumulates text chunks.
 *
 * @param initialSessionId - Optional session ID to resume an existing conversation.
 */
export function useStreamingChat(
  initialSessionId?: string,
  profileId?: string,
  patientNameOverride?: string,
): UseStreamingChatReturn {
  const t = useTranslations('coach');
  const tc = useTranslations('common');
  const [response, setResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [emergency, setEmergency] = useState(false);
  const { isOnline } = useNetworkStatus();

  // Use a ref to hold the session ID so the callback always sees the latest value
  const sessionIdRef = useRef<string | null>(initialSessionId ?? null);
  // Abort controller ref for cancellation
  const abortRef = useRef<AbortController | null>(null);
  // Keep the latest translator in a ref so the stable sendMessage callback can
  // produce localized error strings without being re-created on every render.
  const tRef = useRef(t);
  tRef.current = t;
  const tcRef = useRef(tc);
  tcRef.current = tc;
  // Same treatment for connectivity — lets the stable sendMessage callback
  // distinguish "you're offline" from "the server had a problem" (P2-12).
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;

  const clearError = useCallback(() => setError(null), []);
  const clearEmergency = useCallback(() => setEmergency(false), []);

  const sendMessage = useCallback((message: string) => {
    const accessCode = profileId ? null : getAccessCode();
    const patientName =
      patientNameOverride ?? getPatientName() ?? (profileId ? 'the resident' : 'your loved one');

    if (!accessCode && !profileId) {
      setError(tRef.current('error.no_access_code'));
      return;
    }

    // Reset state for new message
    setResponse('');
    setEmergency(false);
    setIsStreaming(true);
    setError(null);

    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    const processStream = async () => {
      try {
        const stream = await coachChat(
          accessCode,
          patientName,
          message,
          sessionIdRef.current ?? undefined,
          profileId,
        );

        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE lines from buffer
          const lines = buffer.split('\n');
          // Keep the last potentially incomplete line in the buffer
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const data = trimmed.slice(6); // Remove "data: " prefix

            if (data === '[DONE]') {
              // Stream complete
              continue;
            }

            try {
              const parsed = JSON.parse(data) as {
                session_id?: string;
                text?: string;
                replace?: string;
                safety?: { triggered?: boolean; emergency?: boolean; category?: string };
              };

              if (parsed.safety?.emergency) {
                setEmergency(true);
              }

              if (parsed.session_id) {
                sessionIdRef.current = parsed.session_id;
                setSessionId(parsed.session_id);
              }

              if (parsed.replace) {
                // Server-side guard detected bad output — replace entire response
                accumulated = parsed.replace;
                setResponse(accumulated);
              } else if (parsed.text) {
                accumulated += parsed.text;
                setResponse(accumulated);
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Cancelled, ignore
          return;
        } else if (isOnlineRef.current === false) {
          // Known offline — distinct copy so the caregiver knows retrying
          // won't help until connectivity is back (P2-12).
          setError(tcRef.current('network.offline_detail'));
        } else if (err instanceof ApiError) {
          setError(tRef.current('error.something_wrong_status', { status: String(err.status) }));
        } else if (err instanceof RequestTimeoutError) {
          setError(tRef.current('error.connection_failed'));
        } else {
          setError(tRef.current('error.connection_failed'));
        }
      } finally {
        setIsStreaming(false);
      }
    };

    processStream();
  }, []);

  return {
    response,
    isStreaming,
    sessionId,
    error,
    emergency,
    sendMessage,
    clearError,
    clearEmergency,
  };
}
