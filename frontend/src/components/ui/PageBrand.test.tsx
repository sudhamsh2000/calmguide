import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PageBrand } from './PageBrand';

const mocks = vi.hoisted(() => ({
  pathname: '/en-US',
  getFacilityToken: vi.fn(),
  getStoredStaff: vi.fn(),
  getAccessCode: vi.fn(),
  getActiveProfile: vi.fn(),
  getPatientName: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock('@/lib/facility-storage', () => ({
  getFacilityToken: mocks.getFacilityToken,
  getStoredStaff: mocks.getStoredStaff,
}));

vi.mock('@/lib/storage', () => ({
  getAccessCode: mocks.getAccessCode,
  getActiveProfile: mocks.getActiveProfile,
  getPatientName: mocks.getPatientName,
}));

describe('PageBrand', () => {
  beforeEach(() => {
    mocks.pathname = '/en-US';
    mocks.getFacilityToken.mockReset();
    mocks.getStoredStaff.mockReset();
    mocks.getAccessCode.mockReset();
    mocks.getActiveProfile.mockReset();
    mocks.getPatientName.mockReset();

    mocks.getFacilityToken.mockReturnValue(null);
    mocks.getStoredStaff.mockReturnValue(null);
    mocks.getAccessCode.mockReturnValue(null);
    mocks.getActiveProfile.mockReturnValue(null);
    mocks.getPatientName.mockReturnValue(null);
  });

  it('links to home for a remembered caregiver session', async () => {
    mocks.getAccessCode.mockReturnValue('ABCD1234');
    mocks.getPatientName.mockReturnValue('Margaret');

    render(<PageBrand />);

    await waitFor(() => {
      expect(screen.getByText('Calm').closest('a')).toHaveAttribute('href', '/home');
    });
  });

  it('links to facility dashboard for an authenticated facility admin', async () => {
    mocks.pathname = '/en-US/facility/settings';
    mocks.getFacilityToken.mockReturnValue('token');
    mocks.getStoredStaff.mockReturnValue({ role: 'admin' });

    render(<PageBrand />);

    await waitFor(() => {
      expect(screen.getByText('Calm').closest('a')).toHaveAttribute('href', '/facility/dashboard');
    });
  });

  it('links to login for a partial caregiver restore state', async () => {
    mocks.getAccessCode.mockReturnValue('ABCD1234');

    render(<PageBrand />);

    await waitFor(() => {
      expect(screen.getByText('Calm').closest('a')).toHaveAttribute('href', '/login');
    });
  });
});
