import { act, renderHook, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type Callbacks = {
  onConnect?: () => void;
  onMessage?: (p: { message: string; role: 'user' | 'agent' }) => void;
  onDisconnect?: (d: { reason: string }) => void;
  onError?: (m: string) => void;
};

const sdk = vi.hoisted(() => ({
  callbacks: {} as Callbacks,
  startSession: vi.fn(),
  endSession: vi.fn(),
}));

vi.mock('@elevenlabs/react', () => ({
  useConversation: (cb: Callbacks) => {
    sdk.callbacks = cb;
    return {
      startSession: sdk.startSession,
      endSession: sdk.endSession,
      isSpeaking: false,
      isMuted: false,
      setMuted: vi.fn(),
    };
  },
}));

const api = vi.hoisted(() => ({
  startVoiceSession: vi.fn(),
  getVoiceSafety: vi.fn(),
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, ...api };
});

vi.mock('@/lib/storage', () => ({
  getAccessCode: () => 'ABCD1234',
  getPatientName: () => 'Mom',
}));

import { ApiError } from '@/lib/api';
import { useVoiceCall } from './useVoiceCall';

const SESSION = {
  session_id: 'sess-1',
  voice_token: 'tok-1',
  expires_in: 1800,
  agent_id: 'agent_x',
  signed_url: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }),
    },
  });
  api.startVoiceSession.mockResolvedValue(SESSION);
  api.getVoiceSafety.mockResolvedValue({
    triggered: false,
    emergency: false,
    latest_risk_level: null,
    emergency_count: 0,
  });
});

afterEach(cleanup);

async function startedCall() {
  const hook = renderHook(() => useVoiceCall());
  await act(() => hook.result.current.start());
  act(() => sdk.callbacks.onConnect?.());
  return hook;
}

describe('useVoiceCall', () => {
  it('passes the voice token to ElevenLabs as custom LLM extra body', async () => {
    const { result } = await startedCall();
    expect(api.startVoiceSession).toHaveBeenCalledWith('ABCD1234', 'Mom', undefined);
    expect(sdk.startSession).toHaveBeenCalledWith({
      agentId: 'agent_x',
      customLlmExtraBody: { voice_token: 'tok-1' },
    });
    expect(result.current.phase).toBe('live');
  });

  it('connects with the signed URL for a private agent', async () => {
    api.startVoiceSession.mockResolvedValue({ ...SESSION, signed_url: 'wss://signed' });
    await startedCall();
    expect(sdk.startSession).toHaveBeenCalledWith({
      signedUrl: 'wss://signed',
      customLlmExtraBody: { voice_token: 'tok-1' },
    });
  });

  it('reports a refused microphone without contacting the server', async () => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('NotAllowedError'),
    );
    const { result } = renderHook(() => useVoiceCall());
    await act(() => result.current.start());
    expect(result.current.error).toBe('mic_denied');
    expect(api.startVoiceSession).not.toHaveBeenCalled();
  });

  it('reports voice mode unavailable when the server has it off', async () => {
    api.startVoiceSession.mockRejectedValue(new ApiError('off', 404));
    const { result } = renderHook(() => useVoiceCall());
    await act(() => result.current.start());
    expect(result.current.error).toBe('unavailable');
    expect(sdk.startSession).not.toHaveBeenCalled();
  });

  it('raises the emergency alert when an agent turn was an emergency', async () => {
    const { result } = await startedCall();
    api.getVoiceSafety.mockResolvedValue({
      triggered: true,
      emergency: true,
      latest_risk_level: 'emergency',
      emergency_count: 1,
    });
    await act(async () => {
      sdk.callbacks.onMessage?.({ role: 'user', message: 'She is not breathing' });
      sdk.callbacks.onMessage?.({ role: 'agent', message: 'Call 911 now.' });
    });
    expect(api.getVoiceSafety).toHaveBeenCalledWith('sess-1', 'tok-1');
    expect(api.getVoiceSafety).toHaveBeenCalledTimes(1);
    expect(result.current.emergency).toBe(true);
    expect(result.current.transcript.map((l) => l.role)).toEqual(['user', 'agent']);

    // Dismissed, and the next ordinary reply doesn't bring it back...
    act(() => result.current.clearEmergency());
    await act(async () => sdk.callbacks.onMessage?.({ role: 'agent', message: 'Stay with her.' }));
    expect(result.current.emergency).toBe(false);

    // ...but a new emergency turn does.
    api.getVoiceSafety.mockResolvedValue({
      triggered: true,
      emergency: true,
      latest_risk_level: 'emergency',
      emergency_count: 2,
    });
    await act(async () => sdk.callbacks.onMessage?.({ role: 'agent', message: 'Call 911 now.' }));
    expect(result.current.emergency).toBe(true);
  });

  it('flags a dropped call', async () => {
    const { result } = await startedCall();
    act(() => sdk.callbacks.onDisconnect?.({ reason: 'error' }));
    expect(result.current.phase).toBe('ended');
    expect(result.current.error).toBe('dropped');
  });

  it('hangs up when the screen unmounts mid-call', async () => {
    const { unmount } = await startedCall();
    unmount();
    expect(sdk.endSession).toHaveBeenCalled();
  });
});
