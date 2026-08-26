import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileWizard } from './ProfileWizard';
import { ProfileProvider } from '@/context/ProfileContext';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: () => null }),
}));

// Mock the API
vi.mock('@/lib/api', () => ({
  createProfile: vi.fn(),
}));

// Mock storage
vi.mock('@/lib/storage', () => ({
  setPatientName: vi.fn(),
  setAccessCode: vi.fn(),
}));

function renderWizard() {
  return render(
    <ProfileProvider>
      <ProfileWizard />
    </ProfileProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProfileWizard', () => {
  it('renders step 1 with patient name input', () => {
    renderWizard();
    expect(screen.getByText("Let's set up your care profile")).toBeInTheDocument();
    expect(screen.getByLabelText("What is your loved one's first name?")).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
  });

  it('disables Next button when patient name is empty', () => {
    renderWizard();
    const nextButton = screen.getByRole('button', { name: 'Next' });
    expect(nextButton).toBeDisabled();
  });

  it('enables Next button when patient name is entered', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.type(screen.getByLabelText("What is your loved one's first name?"), 'Mom');
    const nextButton = screen.getByRole('button', { name: 'Next' });
    expect(nextButton).not.toBeDisabled();
  });

  it('navigates to step 2 when Next is clicked', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.type(screen.getByLabelText("What is your loved one's first name?"), 'Mom');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
    expect(screen.getByText('What stage best describes your loved one?')).toBeInTheDocument();
  });

  it('navigates back from step 2 to step 1', async () => {
    const user = userEvent.setup();
    renderWizard();

    // Go to step 2
    await user.type(screen.getByLabelText("What is your loved one's first name?"), 'Mom');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    // Go back
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
  });

  it('requires a disease stage selection on step 2', async () => {
    const user = userEvent.setup();
    renderWizard();

    // Step 1
    await user.type(screen.getByLabelText("What is your loved one's first name?"), 'Mom');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    // Step 2 — Next should be disabled
    const nextButton = screen.getByRole('button', { name: 'Next' });
    expect(nextButton).toBeDisabled();

    // Select a stage
    await user.click(screen.getByText('Middle Stage'));
    expect(nextButton).not.toBeDisabled();
  });

  it('navigates through all 5 steps', async () => {
    const user = userEvent.setup();
    renderWizard();

    // Step 1: Patient name
    await user.type(screen.getByLabelText("What is your loved one's first name?"), 'Mom');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    // Step 2: Disease stage
    await user.click(screen.getByText('Middle Stage'));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    // Step 3: Behavioral patterns
    expect(screen.getByText('Step 3 of 5')).toBeInTheDocument();
    await user.click(screen.getByText('Sundowning'));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    // Step 4: Calming strategies
    expect(screen.getByText('Step 4 of 5')).toBeInTheDocument();
    await user.click(screen.getByText('Family photos'));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    // Step 5: Safety concerns — should show Create Profile button
    expect(screen.getByText('Step 5 of 5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Profile' })).toBeInTheDocument();
  });

  it('calls createProfile API and redirects on submit', async () => {
    const user = userEvent.setup();
    const { createProfile } = await import('@/lib/api');
    const { setPatientName, setAccessCode } = await import('@/lib/storage');

    const mockCreateProfile = vi.mocked(createProfile);
    mockCreateProfile.mockResolvedValueOnce({
      id: '1',
      access_code: 'ABCD1234',
      disease_stage: 'middle',
      behavioral_patterns: ['Sundowning'],
      calming_strategies: ['Family photos'],
      safety_concerns: ['Fall risk'],
    });

    renderWizard();

    // Navigate through all steps
    await user.type(screen.getByLabelText("What is your loved one's first name?"), 'Mom');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByText('Middle Stage'));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByText('Sundowning'));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByText('Family photos'));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByText('Fall risk'));
    await user.click(screen.getByRole('button', { name: 'Create Profile' }));

    await waitFor(() => {
      expect(mockCreateProfile).toHaveBeenCalledWith({
        disease_stage: 'middle',
        behavioral_patterns: ['Sundowning'],
        calming_strategies: ['Family photos'],
        safety_concerns: ['Fall risk'],
      });
    });

    await waitFor(() => {
      expect(vi.mocked(setPatientName)).toHaveBeenCalledWith('Mom');
      expect(vi.mocked(setAccessCode)).toHaveBeenCalledWith('ABCD1234');
      expect(mockPush).toHaveBeenCalledWith('/home');
    });
  });

  it('shows error message when API call fails', async () => {
    const user = userEvent.setup();
    const { createProfile } = await import('@/lib/api');
    const mockCreateProfile = vi.mocked(createProfile);
    mockCreateProfile.mockRejectedValueOnce(new Error('Network error'));

    renderWizard();

    // Navigate through all steps
    await user.type(screen.getByLabelText("What is your loved one's first name?"), 'Mom');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByText('Middle Stage'));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByText('Sundowning'));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByText('Family photos'));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByText('Fall risk'));
    await user.click(screen.getByRole('button', { name: 'Create Profile' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
  });
});
