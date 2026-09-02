import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FacilityState } from '@/context/FacilityContext';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  dispatch: vi.fn(),
  getFacilityCode: vi.fn(),
  getFacilityName: vi.fn(),
  getFacilityLoginMode: vi.fn(),
  setFacilityCode: vi.fn(),
  setFacilityName: vi.fn(),
  setFacilityLoginMode: vi.fn(),
  clearFacilityCode: vi.fn(),
  verifyFacilityCode: vi.fn(),
  getActiveStaff: vi.fn(),
  pinLogin: vi.fn(),
  emailLogin: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

let mockFacilityState: FacilityState = {
  staff: null,
  facilityCode: null,
  facilityName: null,
  authenticated: false,
  loading: false,
  error: null,
};

vi.mock('@/context/FacilityContext', () => ({
  useFacility: () => ({
    state: mockFacilityState,
    dispatch: mocks.dispatch,
  }),
}));

vi.mock('@/components/ui/BackButton', () => ({
  BackButton: ({ label }: { label: string }) => <button>{label}</button>,
}));

vi.mock('@/components/facility/PinPad', () => ({
  PinPad: () => <div>PIN pad</div>,
}));

vi.mock('@/components/facility/StaffSelector', () => ({
  StaffSelector: ({
    staff,
    loading,
    onSelect,
  }: {
    staff: Array<{ id: string; name: string }>;
    loading?: boolean;
    onSelect: (staff: { id: string; name: string; role: string }) => void;
  }) => (
    <div>
      <h2>Who&apos;s here?</h2>
      {loading ? (
        <div>Loading staff</div>
      ) : (
        staff.map((member) => (
          <button
            key={member.id}
            type="button"
            onClick={() => onSelect({ ...member, role: 'staff' })}
          >
            {member.name}
          </button>
        ))
      )}
    </div>
  ),
}));

vi.mock('@/lib/facility-storage', () => ({
  getFacilityCode: mocks.getFacilityCode,
  getFacilityName: mocks.getFacilityName,
  getFacilityLoginMode: mocks.getFacilityLoginMode,
  setFacilityCode: mocks.setFacilityCode,
  setFacilityName: mocks.setFacilityName,
  setFacilityLoginMode: mocks.setFacilityLoginMode,
  clearFacilityCode: mocks.clearFacilityCode,
}));

vi.mock('@/lib/facility-api', () => {
  class FacilityApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
      this.name = 'FacilityApiError';
    }
  }

  return {
    FacilityApiError,
    verifyFacilityCode: mocks.verifyFacilityCode,
    getActiveStaff: mocks.getActiveStaff,
    pinLogin: mocks.pinLogin,
    emailLogin: mocks.emailLogin,
  };
});

let FacilityLoginPage: typeof import('./page').default;
let FacilityApiErrorClass: typeof import('@/lib/facility-api').FacilityApiError;

beforeEach(async () => {
  mockFacilityState = {
    staff: null,
    facilityCode: null,
    facilityName: null,
    authenticated: false,
    loading: false,
    error: null,
  };

  mocks.push.mockReset();
  mocks.dispatch.mockReset();
  mocks.getFacilityCode.mockReset();
  mocks.getFacilityName.mockReset();
  mocks.getFacilityLoginMode.mockReset();
  mocks.setFacilityCode.mockReset();
  mocks.setFacilityName.mockReset();
  mocks.setFacilityLoginMode.mockReset();
  mocks.clearFacilityCode.mockReset();
  mocks.verifyFacilityCode.mockReset();
  mocks.getActiveStaff.mockReset();
  mocks.pinLogin.mockReset();
  mocks.emailLogin.mockReset();

  mocks.getFacilityCode.mockReturnValue(null);
  mocks.getFacilityName.mockReturnValue(null);
  mocks.getFacilityLoginMode.mockReturnValue(null);
  mocks.verifyFacilityCode.mockResolvedValue({
    id: 'fac-1',
    name: 'Harbor Memory Care',
    is_active: true,
  });
  mocks.getActiveStaff.mockResolvedValue({
    staff: [{ id: 's1', name: 'Asha RN', role: 'staff' }],
  });

  FacilityLoginPage = (await import('./page')).default;
  FacilityApiErrorClass = (await import('@/lib/facility-api')).FacilityApiError;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('FacilityLoginPage', () => {
  it('restores the admin email screen on refresh', () => {
    mocks.getFacilityLoginMode.mockReturnValue('email');
    mocks.getFacilityCode.mockReturnValue('ABCD1234');
    mocks.getFacilityName.mockReturnValue('Harbor Memory Care');

    render(<FacilityLoginPage />);

    expect(screen.getByRole('heading', { name: 'Admin Login' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Facility Code')).not.toBeInTheDocument();
    expect(mocks.verifyFacilityCode).not.toHaveBeenCalled();
    expect(mocks.getActiveStaff).not.toHaveBeenCalled();
  });

  it('shows the staff restore state immediately for remembered staff login', () => {
    mocks.getFacilityLoginMode.mockReturnValue('staff-select');
    mocks.getFacilityCode.mockReturnValue('ABCD1234');
    mocks.verifyFacilityCode.mockImplementation(() => new Promise(() => {}));
    mocks.getActiveStaff.mockImplementation(() => new Promise(() => {}));

    render(<FacilityLoginPage />);

    expect(screen.getByText("Who's here?")).toBeInTheDocument();
    expect(screen.getByText('Loading staff')).toBeInTheDocument();
    expect(screen.queryByLabelText('Facility Code')).not.toBeInTheDocument();
  });

  it('falls back to the facility code form if remembered staff restore fails', async () => {
    mocks.getFacilityLoginMode.mockReturnValue('staff-select');
    mocks.getFacilityCode.mockReturnValue('ABCD1234');
    mocks.verifyFacilityCode.mockRejectedValue(
      new FacilityApiErrorClass('Facility not found', 404),
    );
    mocks.getActiveStaff.mockResolvedValue({ staff: [] });

    render(<FacilityLoginPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Facility Code')).toBeInTheDocument();
    });

    expect(screen.getByText(/facility code not recognized/i)).toBeInTheDocument();
  });

  it('redirects authenticated admins away from the login page on refresh', async () => {
    mockFacilityState = {
      staff: {
        id: 'admin-1',
        name: 'Maya Admin',
        email: 'maya@example.com',
        role: 'admin',
        language_preference: 'en',
        is_active: true,
        last_login_at: null,
        assigned_patients_count: 0,
        created_at: '2026-01-01T00:00:00Z',
      },
      facilityCode: 'ABCD1234',
      facilityName: 'Harbor Memory Care',
      authenticated: true,
      loading: false,
      error: null,
    };

    render(<FacilityLoginPage />);

    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith('/facility/dashboard');
    });
  });

  it('reloads the staff roster when returning from admin login to staff login', async () => {
    const user = userEvent.setup();
    mocks.getFacilityLoginMode.mockReturnValue('email');
    mocks.getFacilityCode.mockReturnValue('ABCD1234');
    mocks.getFacilityName.mockReturnValue('Harbor Memory Care');

    render(<FacilityLoginPage />);

    await user.click(screen.getByRole('button', { name: /back to staff login/i }));

    await waitFor(() => {
      expect(mocks.verifyFacilityCode).toHaveBeenCalledWith('ABCD1234');
      expect(mocks.getActiveStaff).toHaveBeenCalledWith('ABCD1234');
    });
    expect(screen.getByText("Who's here?")).toBeInTheDocument();
  });

  it('clears remembered facility state when the user changes facility', async () => {
    const user = userEvent.setup();
    mocks.getFacilityLoginMode.mockReturnValue('staff-select');
    mocks.getFacilityCode.mockReturnValue('ABCD1234');

    render(<FacilityLoginPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /change facility/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /change facility/i }));

    expect(mocks.clearFacilityCode).toHaveBeenCalled();
    expect(mocks.dispatch).toHaveBeenCalledWith({ type: 'CLEAR_FACILITY' });
    expect(screen.getByLabelText('Facility Code')).toBeInTheDocument();
  });
});
