import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpeakButton } from './SpeakButton';

// Mock next-intl
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
}));

// Neural TTS availability is probed over the network on mount; drive it
// explicitly so both read-aloud paths can be exercised.
const mockGetSpeechStatus = vi.fn<() => Promise<boolean>>().mockResolvedValue(false);
vi.mock('@/lib/api', () => ({
  getSpeechStatus: () => mockGetSpeechStatus(),
  synthesizeSpeech: vi.fn().mockResolvedValue(null),
}));

const mockSpeak = vi.fn();
const mockCancel = vi.fn();
const mockPause = vi.fn();
const mockResume = vi.fn();

function setupSpeechSynthesis() {
  // Mock SpeechSynthesisUtterance constructor
  global.SpeechSynthesisUtterance = vi.fn().mockImplementation(() => ({
    lang: '',
    voice: null,
    onstart: null,
    onend: null,
    onerror: null,
    onpause: null,
    onresume: null,
  })) as unknown as typeof SpeechSynthesisUtterance;

  Object.defineProperty(window, 'speechSynthesis', {
    value: {
      speak: mockSpeak,
      cancel: mockCancel,
      pause: mockPause,
      resume: mockResume,
      speaking: false,
      paused: false,
      getVoices: () => [],
    },
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSpeechStatus.mockResolvedValue(false);
  setupSpeechSynthesis();
});

describe('SpeakButton', () => {
  it('renders when speechSynthesis is available', () => {
    render(<SpeakButton text="Hello world" />);
    expect(screen.getByRole('button', { name: /read aloud/i })).toBeInTheDocument();
  });

  it('does not render when neither read-aloud path is available', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    // Re-render after clearing speechSynthesis — isSupported is determined in useEffect
    // so we need to render fresh with no speechSynthesis
    const { container } = render(<SpeakButton text="Hello" />);
    expect(container.firstChild).toBeNull();
  });

  it('still renders without speechSynthesis when neural TTS is available', async () => {
    // The regression this pins: the button used to be gated on the Web Speech
    // API alone. Neural read-aloud plays through an <audio> element and does
    // not need speechSynthesis at all, so gating on it silently removed a
    // working feature from browsers that lack the API.
    mockGetSpeechStatus.mockResolvedValue(true);
    Object.defineProperty(window, 'speechSynthesis', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    render(<SpeakButton text="Hello" />);
    expect(await screen.findByRole('button', { name: /read aloud/i })).toBeInTheDocument();
  });

  it('calls speechSynthesis.speak on click', async () => {
    const user = userEvent.setup();
    render(<SpeakButton text="Test text" />);
    await user.click(screen.getByRole('button', { name: /read aloud/i }));
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });
});
