import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const synthesizeSpeech = vi.fn<(text: string, timeoutMs?: number) => Promise<string | null>>();
const getSpeechStatus = vi.fn<() => Promise<boolean>>();

vi.mock('@/lib/api', () => ({
  synthesizeSpeech: (text: string, timeoutMs?: number) => synthesizeSpeech(text, timeoutMs),
  getSpeechStatus: () => getSpeechStatus(),
}));

/** Stand-in <audio>: records what played, and ends when the test says so. */
const played: string[] = [];
let current: FakeAudio | null = null;
class FakeAudio {
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src: string;
  constructor(src: string) {
    this.src = src;
  }
  play() {
    played.push(this.src);
    current = this;
    return Promise.resolve();
  }
  pause() {}
}

function finishCurrentClip() {
  const clip = current;
  current = null;
  act(() => clip?.onended?.());
}

import { useSpeechSynthesis } from './useSpeechSynthesis';

async function renderStreaming(neural: boolean) {
  getSpeechStatus.mockResolvedValue(neural);
  const hook = renderHook(() => useSpeechSynthesis({ locale: 'en' }));
  // The neural check resolves after mount; the stream picks its path at start.
  await act(async () => {});
  return hook;
}

beforeEach(() => {
  played.length = 0;
  current = null;
  synthesizeSpeech.mockReset();
  vi.stubGlobal('Audio', FakeAudio);
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  // Unmount while the stubbed globals are still in place.
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('streamed read-aloud', () => {
  it('plays pieces in order, back to back, and stops speaking after the last', async () => {
    synthesizeSpeech.mockImplementation(async (text) => `blob:${text}`);
    const { result } = await renderStreaming(true);

    act(() => result.current.startStream());
    expect(result.current.isSpeaking).toBe(true);

    act(() => result.current.appendToStream('one'));
    await waitFor(() => expect(played).toEqual(['blob:one']));

    act(() => {
      result.current.appendToStream('two');
      result.current.appendToStream('three');
      result.current.endStream();
    });
    finishCurrentClip();
    await waitFor(() => expect(played).toEqual(['blob:one', 'blob:two']));
    finishCurrentClip();
    await waitFor(() => expect(played).toEqual(['blob:one', 'blob:two', 'blob:three']));
    expect(result.current.isSpeaking).toBe(true);
    finishCurrentClip();
    await waitFor(() => expect(result.current.isSpeaking).toBe(false));
  });

  it('keeps reading when the stream has not ended yet and the queue runs dry', async () => {
    synthesizeSpeech.mockImplementation(async (text) => `blob:${text}`);
    const { result } = await renderStreaming(true);

    act(() => {
      result.current.startStream();
      result.current.appendToStream('one');
    });
    await waitFor(() => expect(played).toEqual(['blob:one']));
    finishCurrentClip();
    expect(result.current.isSpeaking).toBe(true);

    act(() => result.current.appendToStream('two'));
    await waitFor(() => expect(played).toEqual(['blob:one', 'blob:two']));
  });

  it('sends a second request for a piece that is slow to come back', async () => {
    vi.useFakeTimers();
    let answerSecond: (url: string) => void = () => {};
    synthesizeSpeech
      .mockImplementationOnce(() => new Promise(() => {})) // hangs
      .mockImplementationOnce(() => new Promise((resolve) => (answerSecond = resolve)));
    const { result } = await renderStreaming(true);

    act(() => {
      result.current.startStream();
      result.current.appendToStream('one');
    });
    expect(synthesizeSpeech).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(3500);
    });
    expect(synthesizeSpeech).toHaveBeenCalledTimes(2);

    await act(async () => answerSecond('blob:retry'));
    expect(played).toEqual(['blob:retry']);
  });

  it('stop ends the reading and nothing queued plays afterwards', async () => {
    synthesizeSpeech.mockImplementation(async (text) => `blob:${text}`);
    const { result } = await renderStreaming(true);

    act(() => {
      result.current.startStream();
      result.current.appendToStream('one');
      result.current.appendToStream('two');
    });
    await waitFor(() => expect(played).toEqual(['blob:one']));

    act(() => result.current.stop());
    expect(result.current.isSpeaking).toBe(false);
    act(() => result.current.appendToStream('three'));
    await act(async () => {});
    expect(played).toEqual(['blob:one']);
  });

  it('makes no neural requests when the server voice is unavailable', async () => {
    const speak = vi.fn();
    vi.stubGlobal('speechSynthesis', {
      speak,
      cancel: vi.fn(),
      getVoices: () => [],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        constructor(public text: string) {}
      },
    );
    const { result } = await renderStreaming(false);

    act(() => {
      result.current.startStream();
      result.current.appendToStream('one');
      result.current.appendToStream('two');
    });
    expect(synthesizeSpeech).not.toHaveBeenCalled();
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0][0].text).toBe('one');
  });
});
