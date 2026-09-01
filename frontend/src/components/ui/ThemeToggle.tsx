'use client';

import { useEffect, useState } from 'react';
import {
  getThemePreference,
  setThemePreference,
  initTheme,
  resolveTheme,
  applyTheme,
  type ThemePreference,
} from '@/lib/theme';

export interface ThemeToggleProps {
  className?: string;
}

const CYCLE: Record<ThemePreference, ThemePreference> = {
  auto: 'light',
  light: 'dark',
  dark: 'auto',
};

const LABELS: Record<ThemePreference, string> = {
  auto: 'Theme: auto',
  light: 'Theme: light',
  dark: 'Theme: dark',
};

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const [preference, setPreference] = useState<ThemePreference>('auto');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPreference(getThemePreference());
    setMounted(true);
    const cleanup = initTheme();
    return cleanup;
  }, []);

  function handleToggle() {
    // Simple light/dark toggle — flip what's currently showing
    const currentResolved = resolveTheme();
    const next: ThemePreference = currentResolved === 'dark' ? 'light' : 'dark';
    setThemePreference(next);
    applyTheme(next);
    setPreference(next);
  }

  if (!mounted) {
    return <div className={`h-11 w-11 ${className}`} />;
  }

  const label = preference === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={label}
      className={[
        'inline-flex items-center justify-center h-11 w-11 rounded-full',
        'bg-foreground/5 hover:bg-foreground/10 transition-colors',
        'text-foreground-muted hover:text-foreground',
        'focus-ring cursor-pointer',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {preference === 'light' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      )}
      {preference === 'dark' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
      {preference === 'auto' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          <path d="M12 7a5 5 0 0 1 0 10" fill="currentColor" opacity="0.3" />
        </svg>
      )}
    </button>
  );
}
