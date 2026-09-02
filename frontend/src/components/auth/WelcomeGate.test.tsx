import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WelcomeGate } from './WelcomeGate';

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  getAccessCode: vi.fn(),
  getPatientName: vi.fn(),
  getActiveProfile: vi.fn(),
  setAccessCode: vi.fn(),
  setPatientName: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock('@/lib/storage', () => ({
  getAccessCode: mocks.getAccessCode,
  getPatientName: mocks.getPatientName,
  getActiveProfile: mocks.getActiveProfile,
  setAccessCode: mocks.setAccessCode,
  setPatientName: mocks.setPatientName,
}));

describe('WelcomeGate', () => {
  beforeEach(() => {
    mocks.replace.mockReset();
    mocks.getAccessCode.mockReset();
    mocks.getPatientName.mockReset();
    mocks.getActiveProfile.mockReset();
    mocks.setAccessCode.mockReset();
    mocks.setPatientName.mockReset();

    mocks.getAccessCode.mockReturnValue(null);
    mocks.getPatientName.mockReturnValue(null);
    mocks.getActiveProfile.mockReturnValue(null);
  });

  it('redirects returning caregiver users to home', async () => {
    mocks.getAccessCode.mockReturnValue('ABCD1234');
    mocks.getPatientName.mockReturnValue('Margaret');

    render(
      <WelcomeGate>
        <div>Welcome content</div>
      </WelcomeGate>,
    );

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith('/home');
    });
    expect(screen.queryByText('Welcome content')).not.toBeInTheDocument();
  });

  it('redirects partial remembered sessions to login', async () => {
    mocks.getAccessCode.mockReturnValue('ABCD1234');
    mocks.getPatientName.mockReturnValue(null);

    render(
      <WelcomeGate>
        <div>Welcome content</div>
      </WelcomeGate>,
    );

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith('/login');
    });
  });

  it('restores the active multi-profile session before redirecting home', async () => {
    mocks.getActiveProfile.mockReturnValue({
      access_code: 'EFGH5678',
      patient_name: 'Helen',
      disease_stage: 'middle',
    });

    render(
      <WelcomeGate>
        <div>Welcome content</div>
      </WelcomeGate>,
    );

    await waitFor(() => {
      expect(mocks.setAccessCode).toHaveBeenCalledWith('EFGH5678');
      expect(mocks.setPatientName).toHaveBeenCalledWith('Helen');
      expect(mocks.replace).toHaveBeenCalledWith('/home');
    });
  });

  it('shows the welcome content for new users', async () => {
    render(
      <WelcomeGate>
        <div>Welcome content</div>
      </WelcomeGate>,
    );

    expect(screen.getByText('Welcome content')).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
