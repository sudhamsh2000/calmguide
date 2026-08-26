import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the theme module
const mockGetThemePreference = vi.fn<() => 'light' | 'dark' | 'auto'>().mockReturnValue('auto');
const mockSetThemePreference = vi.fn();
const mockInitTheme = vi.fn().mockReturnValue(() => {});
const mockResolveTheme = vi.fn<() => 'light' | 'dark'>().mockReturnValue('light');
const mockApplyTheme = vi.fn();

vi.mock('@/lib/theme', () => ({
  getThemePreference: (...args: unknown[]) => mockGetThemePreference(...(args as [])),
  setThemePreference: (...args: unknown[]) => mockSetThemePreference(...(args as [])),
  initTheme: (...args: unknown[]) => mockInitTheme(...(args as [])),
  resolveTheme: (...args: unknown[]) => mockResolveTheme(...(args as [])),
  applyTheme: (...args: unknown[]) => mockApplyTheme(...(args as [])),
}));

import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetThemePreference.mockReturnValue('auto');
    mockResolveTheme.mockReturnValue('light');
  });

  it('renders a button with accessible label', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: /theme/i });
    expect(button).toBeInTheDocument();
  });

  it('shows light indicator when preference is light', () => {
    mockGetThemePreference.mockReturnValue('light');
    render(<ThemeToggle />);
    expect(screen.getByLabelText(/light/i)).toBeInTheDocument();
  });

  it('shows dark indicator when preference is dark', () => {
    mockGetThemePreference.mockReturnValue('dark');
    render(<ThemeToggle />);
    expect(screen.getByLabelText(/dark/i)).toBeInTheDocument();
  });

  it('toggles light -> dark on click when resolved theme is light', async () => {
    const user = userEvent.setup();
    mockGetThemePreference.mockReturnValue('light');
    mockResolveTheme.mockReturnValue('light');
    render(<ThemeToggle />);

    const button = screen.getByRole('button', { name: /theme/i });
    await user.click(button);

    expect(mockSetThemePreference).toHaveBeenCalledWith('dark');
    expect(mockApplyTheme).toHaveBeenCalledWith('dark');
  });

  it('toggles dark -> light on click when resolved theme is dark', async () => {
    const user = userEvent.setup();
    mockGetThemePreference.mockReturnValue('dark');
    mockResolveTheme.mockReturnValue('dark');
    render(<ThemeToggle />);

    const button = screen.getByRole('button', { name: /theme/i });
    await user.click(button);

    expect(mockSetThemePreference).toHaveBeenCalledWith('light');
    expect(mockApplyTheme).toHaveBeenCalledWith('light');
  });

  it('calls initTheme on mount and cleanup on unmount', () => {
    const cleanup = vi.fn();
    mockInitTheme.mockReturnValue(cleanup);

    const { unmount } = render(<ThemeToggle />);
    expect(mockInitTheme).toHaveBeenCalledTimes(1);

    unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('accepts and applies custom className', () => {
    render(<ThemeToggle className="my-custom" />);
    const button = screen.getByRole('button', { name: /theme/i });
    expect(button.className).toContain('my-custom');
  });
});
