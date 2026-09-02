import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileWizard } from './ProfileWizard';
import { ProfileProvider } from '@/context/ProfileContext';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => null }),
}));

// ProfileWizard uses the locale-aware router from next-intl's navigation
// wrapper, not next/navigation directly.
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock the API
vi.mock('@/lib/api', () => ({
  createProfile: vi.fn(),
  validateInviteCode: vi.fn(),
}));

// Mock storage
vi.mock('@/lib/storage', () => ({
  setPatientName: vi.fn(),
  setAccessCode: vi.fn(),
  getPatientName: vi.fn(),
  getAccessCode: vi.fn(),
}));

function renderWizard() {
  return render(
    <ProfileProvider>
      <ProfileWizard />
    </ProfileProvider>,
  );
}

/** New signups always start on the invite-code gate step (private testing).
 * Enters a code and advances past it so the remaining tests can exercise the
 * pre-existing 5-step flow unchanged. */
async function passInviteStep(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Invite code'), 'TESTCODE');
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() => {
    expect(screen.getByLabelText("What is your loved one's first name?")).toBeInTheDocument();
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  const { validateInviteCode } = await import('@/lib/api');
  vi.mocked(validateInviteCode).mockResolvedValue({ valid: true });
});

describe('ProfileWizard', () => {
  it('renders step 1 with the invite-code gate', () => {
    renderWizard();
    expect(screen.getByText('Enter your access code')).toBeInTheDocument();
    expect(screen.getByLabelText('Invite code')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 6')).toBeInTheDocument();
  });

  it('disables Next button when invite code is empty', () => {
    renderWizard();
    const nextButton = screen.getByRole('button', { name: 'Next' });
    expect(nextButton).toBeDisabled();
  });

  it('validates the invite code and advances to the patient name step', async () => {
    const user = userEvent.setup();
    const { validateInviteCode } = await import('@/lib/api');
    renderWizard();

    await passInviteStep(user);

    expect(vi.mocked(validateInviteCode)).toHaveBeenCalledWith('TESTCODE');
    expect(screen.getByText('Step 2 of 6')).toBeInTheDocument();
  });

  it('shows an error and stays on step 1 when the invite code is invalid', async () => {
    const user = userEvent.setup();
    const { validateInviteCode } = await import('@/lib/api');
    vi.mocked(validateInviteCode).mockResolvedValueOnce({ valid: false });
    renderWizard();

    await user.type(screen.getByLabelText('Invite code'), 'BADCODE1');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(
        screen.getByText("That invite code isn't valid. Double check it and try again."),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('Step 1 of 6')).toBeInTheDocument();
  });

  it('disables Next button when patient name is empty', async () => {
    const user = userEvent.setup();
    renderWizard();
    await passInviteStep(user);

    const nextButton = screen.getByRole('button', { name: 'Next' });
    expect(nextButton).toBeDisabled();
  });

  it('enables Next button when patient name is entered', async () => {
    const user = userEvent.setup();
    renderWizard();
    await passInviteStep(user);

    await user.type(screen.getByLabelText("What is your loved one's first name?"), 'Mom');
    const nextButton = screen.getByRole('button', { name: 'Next' });
    expect(nextButton).not.toBeDisabled();
  });

  it('navigates to step 3 when Next is clicked', async () => {
    const user = userEvent.setup();
    renderWizard();
    await passInviteStep(user);

    await user.type(screen.getByLabelText("What is your loved one's first name?"), 'Mom');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Step 3 of 6')).toBeInTheDocument();
    expect(screen.getByText('What stage best describes your loved one?')).toBeInTheDocument();
  });

  it('navigates back from step 3 to step 2', async () => {
    const user = userEvent.setup();
    renderWizard();
    await passInviteStep(user);

    // Go to step 3
    await user.type(screen.getByLabelText("What is your loved one's first name?"), 'Mom');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    // Go back
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Step 2 of 6')).toBeInTheDocument();
  });

  it('requires a disease stage selection on step 3', async () => {
    const user = userEvent.setup();
    renderWizard();
    await passInviteStep(user);

    // Step 2
    await user.type(screen.getByLabelText("What is your loved one's first name?"), 'Mom');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    // Step 3 — Next should be disabled
    const nextButton = screen.getByRole('button', { name: 'Next' });
    expect(nextButton).toBeDisabled();

    // Select a stage
    await user.click(screen.getByText('Middle Stage'));
    expect(nextButton).not.toBeDisabled();
  });

  it('navigates through all 6 steps', async () => {
    const user = userEvent.setup();
    renderWizard();
    await passInviteStep(user);

    // Step 2: Patient name
    await user.type(screen.getByLabelText("What is your loved one's first name?"), 'Mom');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    // Step 3: Disease stage
    await user.click(screen.getByText('Middle Stage'));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    // Step 4: Behavioral patterns
    expect(screen.getByText('Step 4 of 6')).toBeInTheDocument();
    await user.click(screen.getByText('Sundowning (evening agitation)'));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    // Step 5: Calming strategies
    expect(screen.getByText('Step 5 of 6')).toBeInTheDocument();
    await user.click(screen.getByText('Family Photos'));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    // Step 6: Safety concerns — should show Create Profile button
    expect(screen.getByText('Step 6 of 6')).toBeInTheDocument();
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
    await passInviteStep(user);

    // Navigate through remaining steps
    await user.type(screen.getByLabelText("What is your loved one's first name?"), 'Mom');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByText('Middle Stage'));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByText('Sundowning (evening agitation)'));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByText('Family Photos'));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByText('Fall Risk'));
    await user.click(screen.getByRole('button', { name: 'Create Profile' }));

    await waitFor(() => {
      expect(mockCreateProfile).toHaveBeenCalledWith({
        disease_stage: 'middle',
        behavioral_patterns: ['Sundowning'],
        calming_strategies: ['Family photos'],
        safety_concerns: ['Fall risk'],
        invite_code: 'TESTCODE',
      });
    });

    await waitFor(() => {
      expect(vi.mocked(setPatientName)).toHaveBeenCalledWith('Mom');
      expect(vi.mocked(setAccessCode)).toHaveBeenCalledWith('ABCD1234');
    });

    // Submission shows a success screen with the access code first; the
    // redirect only happens once the user acknowledges and continues.
    expect(screen.getByText('Profile Created!')).toBeInTheDocument();
    expect(screen.getByText('ABCD1234')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Using CalmGuide' }));
    expect(mockPush).toHaveBeenCalledWith('/home');
  });

  it('shows error message when API call fails', async () => {
    const user = userEvent.setup();
    const { createProfile } = await import('@/lib/api');
    const mockCreateProfile = vi.mocked(createProfile);
    mockCreateProfile.mockRejectedValueOnce(new Error('Network error'));

    renderWizard();
    await passInviteStep(user);

    // Navigate through remaining steps
    await user.type(screen.getByLabelText("What is your loved one's first name?"), 'Mom');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByText('Middle Stage'));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByText('Sundowning (evening agitation)'));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByText('Family Photos'));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByText('Fall Risk'));
    await user.click(screen.getByRole('button', { name: 'Create Profile' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
  });
});
