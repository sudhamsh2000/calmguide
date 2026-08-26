import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScenarioInteraction } from './ScenarioInteraction';
import type { Scenario } from '@/lib/api';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock the API module
vi.mock('@/lib/api', () => ({
  getScenarios: vi.fn(),
  interactWithScenario: vi.fn(),
}));

// Mock the storage module
vi.mock('@/lib/storage', () => ({
  getAccessCode: vi.fn(() => 'TESTCODE'),
}));

// Mock the ProfileContext
vi.mock('@/context/ProfileContext', () => ({
  useProfile: () => ({
    state: {
      profile: { disease_stage: 'middle' },
      loading: false,
      error: null,
    },
  }),
}));

import { getScenarios, interactWithScenario } from '@/lib/api';
const mockGetScenarios = vi.mocked(getScenarios);
const mockInteract = vi.mocked(interactWithScenario);

const mockScenario: Scenario = {
  id: 'sc-1',
  title: 'Sundowning Agitation',
  description:
    'It is 5:30 PM and your mother is becoming increasingly agitated. She is pacing around the house, wringing her hands, and repeatedly asking to "go home" even though she is home.',
  disease_stage: 'middle',
  category: 'behavioral',
};

describe('ScenarioInteraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetScenarios.mockResolvedValue([mockScenario]);
    mockInteract.mockResolvedValue({
      response:
        '## What You Did Well\nYou stayed calm.\n\n## What to Try Differently\nTry redirecting.\n\n## The Principle at Work\nValidation helps.\n\n## Try This Next\nUse music.\n\n## Build Confidence\nYou are learning.',
    });
  });

  it('renders the scenario title after loading', async () => {
    render(<ScenarioInteraction scenarioId="sc-1" />);
    expect(await screen.findByText('Sundowning Agitation')).toBeInTheDocument();
  });

  it('renders the scenario situation in a highlighted card', async () => {
    render(<ScenarioInteraction scenarioId="sc-1" />);
    await screen.findByText('Sundowning Agitation');

    expect(screen.getByText(/5:30 PM and your mother/)).toBeInTheDocument();
  });

  it('renders a text area for caregiver response', async () => {
    render(<ScenarioInteraction scenarioId="sc-1" />);
    await screen.findByText('Sundowning Agitation');

    const textarea = screen.getByPlaceholderText(/How would you handle this/);
    expect(textarea).toBeInTheDocument();
    expect(textarea.tagName).toBe('TEXTAREA');
  });

  it('renders Get Feedback button', async () => {
    render(<ScenarioInteraction scenarioId="sc-1" />);
    await screen.findByText('Sundowning Agitation');

    expect(screen.getByRole('button', { name: /Get Feedback/ })).toBeInTheDocument();
  });

  it('disables submit button when textarea is empty', async () => {
    render(<ScenarioInteraction scenarioId="sc-1" />);
    await screen.findByText('Sundowning Agitation');

    expect(screen.getByRole('button', { name: /Get Feedback/ })).toBeDisabled();
  });

  it('enables submit button when textarea has content', async () => {
    const user = userEvent.setup();
    render(<ScenarioInteraction scenarioId="sc-1" />);
    await screen.findByText('Sundowning Agitation');

    const textarea = screen.getByPlaceholderText(/How would you handle this/);
    await user.type(textarea, 'I would speak calmly and redirect her attention');

    expect(screen.getByRole('button', { name: /Get Feedback/ })).toBeEnabled();
  });

  it('submits response and shows feedback', async () => {
    const user = userEvent.setup();
    render(<ScenarioInteraction scenarioId="sc-1" />);
    await screen.findByText('Sundowning Agitation');

    const textarea = screen.getByPlaceholderText(/How would you handle this/);
    await user.type(textarea, 'I would speak calmly');
    await user.click(screen.getByRole('button', { name: /Get Feedback/ }));

    // Wait for feedback to appear
    expect(await screen.findByText(/You stayed calm/)).toBeInTheDocument();
    expect(screen.getByText(/Try redirecting/)).toBeInTheDocument();
    expect(screen.getByText(/Validation helps/)).toBeInTheDocument();
  });

  it('calls interactWithScenario with correct payload', async () => {
    const user = userEvent.setup();
    render(<ScenarioInteraction scenarioId="sc-1" />);
    await screen.findByText('Sundowning Agitation');

    const textarea = screen.getByPlaceholderText(/How would you handle this/);
    await user.type(textarea, 'Stay calm and redirect');
    await user.click(screen.getByRole('button', { name: /Get Feedback/ }));

    await screen.findByText(/You stayed calm/);
    expect(mockInteract).toHaveBeenCalledWith({
      scenario_id: 'sc-1',
      disease_stage: 'middle',
      message: 'Stay calm and redirect',
    });
  });

  it('shows loading state while waiting for feedback', async () => {
    mockInteract.mockReturnValue(new Promise(() => {})); // never resolves
    const user = userEvent.setup();
    render(<ScenarioInteraction scenarioId="sc-1" />);
    await screen.findByText('Sundowning Agitation');

    const textarea = screen.getByPlaceholderText(/How would you handle this/);
    await user.type(textarea, 'Stay calm');
    await user.click(screen.getByRole('button', { name: /Get Feedback/ }));

    expect(screen.getByRole('button', { name: /Getting Feedback/ })).toBeDisabled();
  });

  it('shows error when interaction fails', async () => {
    mockInteract.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    render(<ScenarioInteraction scenarioId="sc-1" />);
    await screen.findByText('Sundowning Agitation');

    const textarea = screen.getByPlaceholderText(/How would you handle this/);
    await user.type(textarea, 'Stay calm');
    await user.click(screen.getByRole('button', { name: /Get Feedback/ }));

    expect(
      await screen.findByText(/Unable to get feedback/),
    ).toBeInTheDocument();
  });

  it('renders a back button that navigates to /learn', async () => {
    const user = userEvent.setup();
    render(<ScenarioInteraction scenarioId="sc-1" />);
    await screen.findByText('Sundowning Agitation');

    const backButton = screen.getByRole('button', { name: /Back to scenarios/ });
    expect(backButton).toBeInTheDocument();
    await user.click(backButton);

    expect(mockPush).toHaveBeenCalledWith('/learn');
  });

  it('shows loading state when scenario is being fetched', () => {
    mockGetScenarios.mockReturnValue(new Promise(() => {})); // never resolves
    render(<ScenarioInteraction scenarioId="sc-1" />);

    expect(screen.getByText(/Loading scenario/)).toBeInTheDocument();
  });

  it('shows error when scenario fails to load', async () => {
    mockGetScenarios.mockRejectedValue(new Error('Not found'));
    render(<ScenarioInteraction scenarioId="sc-1" />);

    expect(
      await screen.findByText(/Unable to load this scenario/),
    ).toBeInTheDocument();
  });

  it('renders the category badge on the scenario', async () => {
    render(<ScenarioInteraction scenarioId="sc-1" />);
    await screen.findByText('Sundowning Agitation');

    expect(screen.getByText('Behavioral')).toBeInTheDocument();
  });
});
