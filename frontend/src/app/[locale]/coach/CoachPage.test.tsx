import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

// Mock next/navigation (same pattern as ProfileWizard.test.tsx) — CoachPage
// reads `profile_id` off the search params.
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => null }),
}));

// CoachPage wraps its content in <MedicalDisclaimer>, which gates children
// behind localStorage's disclaimer-accepted flag (see src/lib/storage.ts).
// In jsdom that flag is unset by default, so without this mock the page
// only ever renders the disclaimer gate instead of Phase 1/2 content.
vi.mock('@/lib/storage', () => ({
  getDisclaimerAccepted: () => true,
  getAutoSpeakReplies: () => false,
}));

vi.mock('@/features/coach/useStreamingChat', () => ({
  useStreamingChat: () => ({
    response: '',
    isStreaming: false,
    error: null,
    sendMessage: vi.fn(),
    clearError: vi.fn(),
  }),
}));

vi.mock('@/features/coach/parseResponse', () => ({
  parseCoachResponse: () => [],
}));

vi.mock('@/components/ui/BackButton', () => ({
  BackButton: ({ label }: { label: string }) => <button>{label}</button>,
}));

vi.mock('@/components/ui/BreathingIndicator', () => ({
  BreathingIndicator: () => <div data-testid="breathing-indicator" />,
}));

let CoachPage: typeof import('./page').default;

beforeEach(async () => {
  const mod = await import('./page');
  CoachPage = mod.default;
});

afterEach(cleanup);

describe('CoachPage', () => {
  it('renders Phase 1 — greeting card and big input initially', () => {
    render(<CoachPage />);
    expect(screen.getByText(/take a breath/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get guidance/i })).toBeInTheDocument();
  });

  it('Phase 1 does not show sticky footer send button', () => {
    render(<CoachPage />);
    expect(screen.queryByRole('button', { name: /send/i })).not.toBeInTheDocument();
  });

  it('switches to Phase 2 after submitting a message', async () => {
    const user = userEvent.setup();
    render(<CoachPage />);

    await user.type(screen.getByRole('textbox'), 'Mom is very agitated');
    await user.click(screen.getByRole('button', { name: /get guidance/i }));

    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /get guidance/i })).not.toBeInTheDocument();
  });

  it('shows user message bubble in Phase 2', async () => {
    const user = userEvent.setup();
    render(<CoachPage />);

    await user.type(screen.getByRole('textbox'), 'Mom is very agitated');
    await user.click(screen.getByRole('button', { name: /get guidance/i }));

    expect(screen.getByText('Mom is very agitated')).toBeInTheDocument();
  });

  it('shows "Moment Coach" heading in both phases', () => {
    render(<CoachPage />);
    expect(screen.getByText('Moment Coach')).toBeInTheDocument();
  });
});
