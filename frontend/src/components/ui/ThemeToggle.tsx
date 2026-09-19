'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  getThemePreference,
  setThemePreference,
  initTheme,
  resolveTheme,
  applyTheme,
  type ThemeMode,
  type ThemePreference,
} from '@/lib/theme';

export interface ThemeToggleProps {
  className?: string;
  /**
   * `icon` (default) is the round single-glyph button used in the app shell
   * header. `pill` is the segmented sun/moon track from the dashboard
   * design. Both render one button with the same accessible name, so the
   * behaviour and the existing tests are identical either way.
   */
  variant?: 'icon' | 'pill';
}

export function ThemeToggle({ className = '', variant = 'icon' }: ThemeToggleProps) {
  const t = useTranslations('common');
  const [preference, setPreference] = useState<ThemePreference>('auto');
  const [resolved, setResolved] = useState<ThemeMode>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPreference(getThemePreference());
    setResolved(resolveTheme());
    setMounted(true);
    const cleanup = initTheme();
    return cleanup;
  }, []);

  function handleToggle() {
    // Flip what's on screen right now, which is the resolved theme rather than
    // the stored preference — under 'auto' the two disagree, and going by
    // preference alone would send the first click the wrong way.
    const next: ThemeMode = resolveTheme() === 'dark' ? 'light' : 'dark';
    setThemePreference(next);
    applyTheme(next);
    setPreference(next);
    setResolved(next);
  }

  if (!mounted) {
    return variant === 'pill' ? (
      <div className={`h-10 w-[76px] rounded-full ${className}`} />
    ) : (
      <div className={`h-11 w-11 ${className}`} />
    );
  }

  // Names the action rather than the current state, and keys off the resolved
  // theme so 'auto' that resolves to dark still offers "switch to light".
  const label =
    resolved === 'dark' ? t('accessibility.switch_light') : t('accessibility.switch_dark');

  if (variant === 'pill') {
    // The thumb marks the theme that is currently on, and slides to the
    // other side on click. Both glyphs stay visible so the control reads as
    // a choice between two states rather than an unlabelled button.
    const isDark = resolved === 'dark';
    return (
      <button
        type="button"
        onClick={handleToggle}
        aria-label={label}
        className={[
          'relative inline-flex h-10 w-[76px] shrink-0 items-center rounded-full p-1',
          'border border-theme-soft bg-surface transition-colors',
          'focus-ring cursor-pointer',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span
          aria-hidden="true"
          className={[
            'absolute top-1 h-8 w-8 rounded-full bg-primary transition-transform duration-200 ease-out',
            isDark ? 'translate-x-[34px]' : 'translate-x-0',
          ].join(' ')}
          style={{ left: '4px' }}
        />
        <span
          aria-hidden="true"
          className={`relative z-10 flex h-8 w-8 items-center justify-center ${
            isDark ? 'text-foreground-muted' : 'text-onPrimary'
          }`}
        >
          <SunGlyph />
        </span>
        <span
          aria-hidden="true"
          className={`relative z-10 flex h-8 w-8 items-center justify-center ${
            isDark ? 'text-onPrimary' : 'text-foreground-muted'
          }`}
        >
          <MoonGlyph />
        </span>
      </button>
    );
  }

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
        <svg
          data-testid="theme-icon-light"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
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
        <svg
          data-testid="theme-icon-dark"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
      {preference === 'auto' && (
        <svg
          data-testid="theme-icon-auto"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          <path d="M12 7a5 5 0 0 1 0 10" fill="currentColor" opacity="0.3" />
        </svg>
      )}
    </button>
  );
}

/* Shared glyphs for the pill variant. Same geometry as the icon variant's
 * inline SVGs, extracted so the two states can sit side by side. */
function SunGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
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
  );
}

function MoonGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
