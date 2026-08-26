import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScenarioList } from './ScenarioList';
import type { Scenario } from '@/lib/api';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock the API module
vi.mock('@/lib/api', () => ({
  getScenarios: vi.fn(),
}));

import { getScenarios } from '@/lib/api';
const mockGetScenarios = vi.mocked(getScenarios);

const mockScenarios: Scenario[] = [
  {
    id: 'sc-1',
    title: 'Sundowning Agitation',
    description: 'Your loved one becomes increasingly agitated and confused as evening approaches.',
    disease_stage: 'middle',
    category: 'behavioral',
  },
  {
    id: 'sc-2',
    title: 'Refusing to Bathe',
    description: 'Your loved one resists bathing and becomes upset when you suggest it.',
    disease_stage: 'early',
    category: 'daily_care',
  },
  {
    id: 'sc-3',
    title: 'Wandering at Night',
    description: 'You wake up to find your loved one trying to leave the house at 2am.',
    disease_stage: 'middle',
    category: 'safety',
  },
  {
    id: 'sc-4',
    title: 'Repeated Questions',
    description: 'Your loved one asks the same question over and over within minutes.',
    disease_stage: 'early',
    category: 'communication',
  },
  {
    id: 'sc-5',
    title: 'Caregiver Burnout',
    description: 'You feel overwhelmed and exhausted from constant caregiving responsibilities.',
    disease_stage: 'middle',
    category: 'self_care',
  },
];

describe('ScenarioList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetScenarios.mockResolvedValue(mockScenarios);
  });

  it('renders the heading and subtitle', async () => {
    render(<ScenarioList />);
    expect(screen.getByText('Practice Scenarios')).toBeInTheDocument();
    expect(
      screen.getByText(/Practice common situations/),
    ).toBeInTheDocument();
  });

  it('renders scenario cards after loading', async () => {
    render(<ScenarioList />);

    // Wait for scenarios to load
    expect(await screen.findByText('Sundowning Agitation')).toBeInTheDocument();
    expect(screen.getByText('Refusing to Bathe')).toBeInTheDocument();
    expect(screen.getByText('Wandering at Night')).toBeInTheDocument();
    expect(screen.getByText('Repeated Questions')).toBeInTheDocument();
    expect(screen.getByText('Caregiver Burnout')).toBeInTheDocument();
  });

  it('renders category badges on each scenario card', async () => {
    render(<ScenarioList />);
    await screen.findByText('Sundowning Agitation');

    // Category badges appear on cards (as <span> elements with data-category)
    // Filter chips also have the same text, so we scope to badge elements
    const badges = screen.getAllByText('Behavioral');
    expect(badges.length).toBeGreaterThanOrEqual(2); // chip + card badge

    const dailyCareBadges = screen.getAllByText('Daily Care');
    expect(dailyCareBadges.length).toBeGreaterThanOrEqual(2);

    const safetyBadges = screen.getAllByText('Safety');
    expect(safetyBadges.length).toBeGreaterThanOrEqual(2);

    const commBadges = screen.getAllByText('Communication');
    expect(commBadges.length).toBeGreaterThanOrEqual(2);

    const selfCareBadges = screen.getAllByText('Self Care');
    expect(selfCareBadges.length).toBeGreaterThanOrEqual(2);
  });

  it('renders disease stage badges on cards', async () => {
    render(<ScenarioList />);
    await screen.findByText('Sundowning Agitation');

    // Multiple "middle" badges and "early" badges
    const middleBadges = screen.getAllByText(/middle/i);
    const earlyBadges = screen.getAllByText(/early/i);
    expect(middleBadges.length).toBeGreaterThan(0);
    expect(earlyBadges.length).toBeGreaterThan(0);
  });

  it('shows loading state initially', () => {
    mockGetScenarios.mockReturnValue(new Promise(() => {})); // never resolves
    render(<ScenarioList />);

    expect(screen.getByText(/Loading scenarios/)).toBeInTheDocument();
  });

  it('shows error state on fetch failure', async () => {
    mockGetScenarios.mockRejectedValue(new Error('Network error'));
    render(<ScenarioList />);

    expect(
      await screen.findByText(/Unable to load scenarios/),
    ).toBeInTheDocument();
  });

  it('renders category filter chips', async () => {
    render(<ScenarioList />);

    expect(screen.getByRole('option', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Behavioral' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Daily Care' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Safety' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Communication' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Self Care' })).toBeInTheDocument();
  });

  it('filters scenarios when a category chip is selected', async () => {
    const user = userEvent.setup();
    render(<ScenarioList />);
    await screen.findByText('Sundowning Agitation');

    // Click "Safety" filter
    await user.click(screen.getByRole('option', { name: 'Safety' }));

    // Only safety scenario should remain visible
    expect(screen.getByText('Wandering at Night')).toBeInTheDocument();
    expect(screen.queryByText('Sundowning Agitation')).not.toBeInTheDocument();
    expect(screen.queryByText('Refusing to Bathe')).not.toBeInTheDocument();
  });

  it('shows all scenarios when All chip is selected after filtering', async () => {
    const user = userEvent.setup();
    render(<ScenarioList />);
    await screen.findByText('Sundowning Agitation');

    // Filter to safety
    await user.click(screen.getByRole('option', { name: 'Safety' }));
    expect(screen.queryByText('Sundowning Agitation')).not.toBeInTheDocument();

    // Click All to show all again
    await user.click(screen.getByRole('option', { name: 'All' }));
    expect(screen.getByText('Sundowning Agitation')).toBeInTheDocument();
    expect(screen.getByText('Wandering at Night')).toBeInTheDocument();
  });

  it('navigates to scenario detail on card click', async () => {
    const user = userEvent.setup();
    render(<ScenarioList />);
    await screen.findByText('Sundowning Agitation');

    const card = screen.getByText('Sundowning Agitation').closest('[data-testid="scenario-card"]');
    expect(card).toBeInTheDocument();
    await user.click(card!);

    expect(mockPush).toHaveBeenCalledWith('/learn/sc-1');
  });

  it('truncates long descriptions to 2 lines via CSS class', async () => {
    render(<ScenarioList />);
    await screen.findByText('Sundowning Agitation');

    const description = screen.getByText(
      /Your loved one becomes increasingly agitated/,
    );
    expect(description.className).toContain('line-clamp-2');
  });

  it('shows empty state when no scenarios match filter', async () => {
    mockGetScenarios.mockResolvedValue([
      mockScenarios[0], // only behavioral
    ]);
    const user = userEvent.setup();
    render(<ScenarioList />);
    await screen.findByText('Sundowning Agitation');

    // Filter to safety — no matches
    await user.click(screen.getByRole('option', { name: 'Safety' }));

    expect(screen.getByText(/No scenarios found/)).toBeInTheDocument();
  });

  it('calls getScenarios on mount', async () => {
    render(<ScenarioList />);
    await screen.findByText('Sundowning Agitation');

    expect(mockGetScenarios).toHaveBeenCalledOnce();
  });
});
