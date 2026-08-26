import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfileView } from './ProfileView';
import { ProfileProvider } from '@/context/ProfileContext';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const mockGetAccessCode = vi.fn();
const mockGetPatientName = vi.fn();
vi.mock('@/lib/storage', () => ({
  getAccessCode: (...args: unknown[]) => mockGetAccessCode(...args),
  getPatientName: (...args: unknown[]) => mockGetPatientName(...args),
}));

vi.mock('@/lib/api', () => ({
  getProfile: vi.fn(),
}));

function renderProfile() {
  return render(
    <ProfileProvider>
      <ProfileView />
    </ProfileProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAccessCode.mockReturnValue(null);
  mockGetPatientName.mockReturnValue(null);
});

describe('ProfileView', () => {
  it('redirects to setup if no access code', () => {
    renderProfile();
    expect(mockPush).toHaveBeenCalledWith('/profile/setup');
  });

  it('renders patient name and initial', () => {
    mockGetAccessCode.mockReturnValue('KM7X4PQ2');
    mockGetPatientName.mockReturnValue('Margaret');
    renderProfile();

    expect(screen.getByText('Margaret')).toBeInTheDocument();
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('renders access code formatted with separator', () => {
    mockGetAccessCode.mockReturnValue('KM7X4PQ2');
    mockGetPatientName.mockReturnValue('Margaret');
    renderProfile();

    expect(screen.getByText(/KM7X/)).toBeInTheDocument();
    expect(screen.getByText(/4PQ2/)).toBeInTheDocument();
  });

  it('has back link to home', () => {
    mockGetAccessCode.mockReturnValue('ABCD1234');
    mockGetPatientName.mockReturnValue('Mom');
    renderProfile();

    const backLink = screen.getByLabelText('Back to home');
    expect(backLink).toHaveAttribute('href', '/home');
  });

  it('has edit profile link', () => {
    mockGetAccessCode.mockReturnValue('ABCD1234');
    mockGetPatientName.mockReturnValue('Mom');
    renderProfile();

    const editLink = screen.getByText('Edit Profile');
    expect(editLink.closest('a')).toHaveAttribute('href', '/profile/setup?edit=true');
  });

  it('shows privacy message for name', () => {
    mockGetAccessCode.mockReturnValue('ABCD1234');
    mockGetPatientName.mockReturnValue('Mom');
    renderProfile();

    expect(screen.getByText('Name stored on your device only')).toBeInTheDocument();
  });
});
