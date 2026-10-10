import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { VoiceCallView, type VoiceCallViewProps } from './VoiceCallView';

vi.mock('@/components/ui/BackButton', () => ({
  BackButton: ({ label }: { label: string }) => <button>{label}</button>,
}));

afterEach(cleanup);

function renderView(overrides: Partial<VoiceCallViewProps> = {}) {
  const props: VoiceCallViewProps = {
    phase: 'idle',
    error: null,
    transcript: [],
    emergency: false,
    isSpeaking: false,
    isMuted: false,
    backHref: '/coach',
    textCoachHref: '/coach',
    onStart: vi.fn(),
    onEnd: vi.fn(),
    onToggleMute: vi.fn(),
    onDismissEmergency: vi.fn(),
    ...overrides,
  };
  render(<VoiceCallView {...props} />);
  return props;
}

describe('VoiceCallView', () => {
  it('idle: offers to start a call', async () => {
    const props = renderView();
    expect(screen.getByText('Ready when you are')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Start voice call' }));
    expect(props.onStart).toHaveBeenCalled();
  });

  it('live: pins the emergency call button with the locale number', () => {
    renderView({ phase: 'live' });
    const call = screen.getByRole('link', { name: /call 911/i });
    expect(call).toHaveAttribute('href', 'tel:911');
    expect(screen.getByText('Listening…')).toBeInTheDocument();
  });

  it('live: mute and end call', async () => {
    const props = renderView({ phase: 'live' });
    await userEvent.click(screen.getByRole('button', { name: 'Mute' }));
    await userEvent.click(screen.getByRole('button', { name: 'End call' }));
    expect(props.onToggleMute).toHaveBeenCalled();
    expect(props.onEnd).toHaveBeenCalled();
  });

  it('shows who said what', () => {
    renderView({
      phase: 'live',
      isSpeaking: true,
      transcript: [
        { id: 1, role: 'user', text: 'Mom will not sit down' },
        { id: 2, role: 'agent', text: 'Sit beside her and lower your voice.' },
      ],
    });
    expect(screen.getByText('CalmGuide is speaking')).toBeInTheDocument();
    expect(screen.getByText('Mom will not sit down')).toBeInTheDocument();
    expect(screen.getByText('Sit beside her and lower your voice.')).toBeInTheDocument();
  });

  it('raises the full-screen emergency alert', () => {
    renderView({ phase: 'live', emergency: true });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('explains a refused microphone and offers to retry', () => {
    renderView({ phase: 'error', error: 'mic_denied' });
    expect(screen.getByRole('alert')).toHaveTextContent(/needs your microphone/i);
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
  });
});
