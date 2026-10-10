'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useConversation } from '@elevenlabs/react';
import { ApiError, getVoiceSafety, startVoiceSession } from '@/lib/api';
import { getAccessCode, getPatientName } from '@/lib/storage';

export type VoiceCallPhase = 'idle' | 'starting' | 'live' | 'ended' | 'error';

export type VoiceCallError =
  /** Voice mode is off or the agent isn't configured on the server. */
  | 'unavailable'
  /** The browser refused the microphone. */
  | 'mic_denied'
  /** No access code (family) — the caregiver hasn't set up a profile. */
  | 'no_profile'
  /** Could not connect, or the connection errored. */
  | 'failed'
  /** A live call ended without the caregiver ending it. */
  | 'dropped';

export interface TranscriptLine {
  id: number;
  role: 'user' | 'agent';
  text: string;
}

interface ActiveCall {
  sessionId: string;
  token: string;
  /** Emergency turns already alerted on, so a dismissed alert comes back
   * only for a *new* emergency turn. */
  seenEmergencies: number;
}

const MAX_TRANSCRIPT_LINES = 50;

/**
 * One voice call with the CalmGuide ElevenLabs agent.
 *
 * ElevenLabs does the listening and speaking; CalmGuide's backend answers
 * every turn behind it (safety gate first). The SDK only gives us the
 * agent's words, so after each agent reply we ask the backend whether that
 * turn was an emergency and raise the same alert typed chat shows.
 *
 * Must be rendered inside an `@elevenlabs/react` ConversationProvider.
 */
export function useVoiceCall({
  profileId,
  patientNameOverride,
}: { profileId?: string; patientNameOverride?: string } = {}) {
  const [phase, setPhase] = useState<VoiceCallPhase>('idle');
  const [error, setError] = useState<VoiceCallError | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [emergency, setEmergency] = useState(false);

  const phaseRef = useRef<VoiceCallPhase>('idle');
  const callRef = useRef<ActiveCall | null>(null);
  const lineId = useRef(0);

  const moveTo = useCallback((next: VoiceCallPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const fail = useCallback(
    (code: VoiceCallError) => {
      setError(code);
      moveTo('error');
    },
    [moveTo],
  );

  const checkSafety = useCallback(async () => {
    const call = callRef.current;
    if (!call) return;
    try {
      const status = await getVoiceSafety(call.sessionId, call.token);
      if (status.emergency_count > call.seenEmergencies) {
        call.seenEmergencies = status.emergency_count;
        setEmergency(true);
      }
    } catch {
      // The always-visible call button covers this; never break the call
      // over a failed status check.
    }
  }, []);

  const conversation = useConversation({
    onConnect: () => moveTo('live'),
    onMessage: (payload) => {
      const text = payload.message?.trim();
      if (!text) return;
      const role: TranscriptLine['role'] = payload.role === 'agent' ? 'agent' : 'user';
      setTranscript((prev) =>
        [...prev, { id: ++lineId.current, role, text }].slice(-MAX_TRANSCRIPT_LINES),
      );
      if (role === 'agent') void checkSafety();
    },
    onDisconnect: (details) => {
      const wasLive = phaseRef.current === 'live';
      const wasStarting = phaseRef.current === 'starting';
      callRef.current = null;
      if (details.reason === 'user') {
        moveTo('ended');
      } else if (wasStarting) {
        fail('failed');
      } else if (wasLive) {
        setError(details.reason === 'error' ? 'dropped' : null);
        moveTo('ended');
      }
    },
    onError: () => {
      if (phaseRef.current === 'starting' || phaseRef.current === 'live') fail('failed');
    },
  });

  const start = useCallback(async () => {
    if (phaseRef.current === 'starting' || phaseRef.current === 'live') return;
    setError(null);
    setTranscript([]);
    setEmergency(false);

    const accessCode = profileId ? null : getAccessCode();
    if (!profileId && !accessCode) {
      fail('no_profile');
      return;
    }
    moveTo('starting');

    // Ask for the microphone first so a refusal gets its own clear message
    // instead of a generic connection failure from inside the SDK.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      fail('mic_denied');
      return;
    }

    let session;
    try {
      const patientName =
        patientNameOverride ?? getPatientName() ?? (profileId ? 'the resident' : 'your loved one');
      session = await startVoiceSession(accessCode, patientName, profileId);
    } catch (err) {
      fail(
        err instanceof ApiError && (err.status === 404 || err.status === 503)
          ? 'unavailable'
          : 'failed',
      );
      return;
    }

    callRef.current = {
      sessionId: session.session_id,
      token: session.voice_token,
      seenEmergencies: 0,
    };
    const connection = session.signed_url
      ? { signedUrl: session.signed_url }
      : { agentId: session.agent_id };
    conversation.startSession({
      ...connection,
      customLlmExtraBody: { voice_token: session.voice_token },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, patientNameOverride, fail, moveTo, conversation.startSession]);

  const end = useCallback(() => {
    conversation.endSession();
    callRef.current = null;
    moveTo('ended');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.endSession, moveTo]);

  // Leaving the screen must hang up — an open mic in a background tab is
  // the last thing a caregiver expects.
  const endSessionRef = useRef(conversation.endSession);
  endSessionRef.current = conversation.endSession;
  useEffect(
    () => () => {
      if (phaseRef.current === 'starting' || phaseRef.current === 'live') endSessionRef.current();
    },
    [],
  );

  return {
    phase,
    error,
    transcript,
    emergency,
    clearEmergency: useCallback(() => setEmergency(false), []),
    isSpeaking: conversation.isSpeaking,
    isMuted: conversation.isMuted,
    setMuted: conversation.setMuted,
    start,
    end,
  };
}
