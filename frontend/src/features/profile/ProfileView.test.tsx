import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfileView } from './ProfileView';
import { ProfileProvider } from '@/context/ProfileContext';

// ProfileView uses the locale-aware router/Link from next-intl's navigation
// wrapper (@/i18n/navigation), not next/navigation or next/link directly.
const mockPush = vi.fn();
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  usePathname: () => '/profile',
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockGetAccessCode = vi.fn();
const mockGetPatientName = vi.fn();
vi.mock('@/lib/storage', () => ({
  getAccessCode: (...args: unknown[]) => mockGetAccessCode(...args),
  getPatientName: (...args: unknown[]) => mockGetPatientName(...args),
  clearAll: vi.fn(),
  getAutoSpeakReplies: vi.fn(() => false),
  setAutoSpeakReplies: vi.fn(),
  getActiveProfileAvatar: vi.fn(() => 'monogram'),
  noSessionRedirectPath: vi.fn(() => '/profile/setup'),
}));

const mockProfile = {
  id: 'profile-1',
  disease_stage: 'middle',
  behavioral_patterns: [],
  calming_strategies: [],
  safety_concerns: [],
};

vi.mock('@/lib/api', () => ({
  getProfile: vi.fn(() => Promise.resolve(mockProfile)),
}));

// ProfileView renders a real <ThemeToggle>, whose effect calls
// window.matchMedia() (via @/lib/theme's initTheme/resolveTheme) — not
// implemented in jsdom. Same mock shape as ThemeToggle.test.tsx.
vi.mock('@/lib/theme', () => ({
  getThemePreference: () => 'auto',
  setThemePreference: vi.fn(),
  initTheme: vi.fn(() => () => {}),
  resolveTheme: () => 'light',
  applyTheme: vi.fn(),
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

  it('renders patient name and initial', async () => {
    mockGetAccessCode.mockReturnValue('KM7X4PQ2');
    mockGetPatientName.mockReturnValue('Margaret');
    renderProfile();

    // ProfileView shows a loading spinner until the profile fetch (an
    // async getProfile() call) resolves, so the name/initial only appear
    // after that microtask flushes.
    expect(await screen.findByText('Margaret')).toBeInTheDocument();
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('renders access code formatted with separator', async () => {
    mockGetAccessCode.mockReturnValue('KM7X4PQ2');
    mockGetPatientName.mockReturnValue('Margaret');
    renderProfile();

    expect(await screen.findByText(/KM7X/)).toBeInTheDocument();
    expect(screen.getByText(/4PQ2/)).toBeInTheDocument();
  });

  it('has back link to home', async () => {
    mockGetAccessCode.mockReturnValue('ABCD1234');
    mockGetPatientName.mockReturnValue('Mom');
    renderProfile();

    const backLink = await screen.findByLabelText('Back to home');
    expect(backLink).toHaveAttribute('href', '/home');
  });

  it('has edit profile link', async () => {
    mockGetAccessCode.mockReturnValue('ABCD1234');
    mockGetPatientName.mockReturnValue('Mom');
    renderProfile();

    // ProfileView now links to the dedicated /profile/edit page (see
    // src/app/[locale]/profile/edit/page.tsx) rather than the setup wizard
    // with an ?edit=true query param.
    const editLink = await screen.findByText('Edit Profile');
    expect(editLink.closest('a')).toHaveAttribute('href', '/profile/edit');
  });

  it('shows privacy message for name', async () => {
    mockGetAccessCode.mockReturnValue('ABCD1234');
    mockGetPatientName.mockReturnValue('Mom');
    renderProfile();

    expect(await screen.findByText('Name stored on your device only')).toBeInTheDocument();
  });
});
