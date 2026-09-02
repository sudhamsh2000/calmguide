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

  it('labels the button with the action it will take, from translations', () => {
    mockResolveTheme.mockReturnValue('light');
    render(<ThemeToggle />);
    // Showing light, so the button offers dark. The string comes from
    // common.json's accessibility block, not a hardcoded literal.
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
  });

  it('offers the opposite direction when the resolved theme is dark', () => {
    mockResolveTheme.mockReturnValue('dark');
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
  });

  it('labels by resolved theme, not preference, when preference is auto', () => {
    // The regression this pins: 'auto' resolving to dark used to still read
    // "Switch to dark mode" while a click actually set light.
    mockGetThemePreference.mockReturnValue('auto');
    mockResolveTheme.mockReturnValue('dark');
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
  });

  it('shows light indicator when preference is light', () => {
    mockGetThemePreference.mockReturnValue('light');
    render(<ThemeToggle />);
    expect(screen.getByTestId('theme-icon-light')).toBeInTheDocument();
  });

  it('shows dark indicator when preference is dark', () => {
    mockGetThemePreference.mockReturnValue('dark');
    render(<ThemeToggle />);
    expect(screen.getByTestId('theme-icon-dark')).toBeInTheDocument();
  });

  it('toggles light -> dark on click when resolved theme is light', async () => {
    const user = userEvent.setup();
    mockGetThemePreference.mockReturnValue('light');
    mockResolveTheme.mockReturnValue('light');
    render(<ThemeToggle />);

    await user.click(screen.getByRole('button'));

    expect(mockSetThemePreference).toHaveBeenCalledWith('dark');
    expect(mockApplyTheme).toHaveBeenCalledWith('dark');
  });

  it('toggles dark -> light on click when resolved theme is dark', async () => {
    const user = userEvent.setup();
    mockGetThemePreference.mockReturnValue('dark');
    mockResolveTheme.mockReturnValue('dark');
    render(<ThemeToggle />);

    await user.click(screen.getByRole('button'));

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
    expect(screen.getByRole('button').className).toContain('my-custom');
  });
});
