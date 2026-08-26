export type ThemeMode = 'light' | 'dark';
export type ThemePreference = 'light' | 'dark' | 'auto';

export const THEME_COOKIE = 'calmguide_theme';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

function readThemeCookie(): 'light' | 'dark' | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)calmguide_theme=([^;]+)/);
  const value = match?.[1];
  if (value === 'light' || value === 'dark') return value;
  return null;
}

function writeThemeCookie(value: 'light' | 'dark'): void {
  document.cookie = `${THEME_COOKIE}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function deleteThemeCookie(): void {
  document.cookie = `${THEME_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

/**
 * Determines if the current time falls within nighttime hours (8pm-6am).
 */
export function isNighttime(now: Date = new Date()): boolean {
  const hour = now.getHours();
  return hour >= 20 || hour < 6;
}

/**
 * Checks if the user's system prefers dark mode.
 */
export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Resolves the active theme based on priority:
 * 1. Explicit preference stored in cookie
 * 2. System preference (prefers-color-scheme)
 * 3. Time-based (dark between 8pm-6am)
 */
export function resolveTheme(): ThemeMode {
  const pref = readThemeCookie();
  if (pref) return pref;
  if (systemPrefersDark()) return 'dark';
  return isNighttime() ? 'dark' : 'light';
}

/**
 * Returns the current theme preference: 'light', 'dark', or 'auto'.
 */
export function getThemePreference(): ThemePreference {
  return readThemeCookie() ?? 'auto';
}

/**
 * Applies the given theme by toggling the 'dark' class on <html>.
 */
export function applyTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

/**
 * Sets the theme preference and applies it.
 * 'auto' removes the explicit preference (reverts to system/time logic).
 */
export function setThemePreference(pref: ThemePreference): void {
  if (typeof document === 'undefined') return;
  if (pref === 'auto') {
    deleteThemeCookie();
  } else {
    writeThemeCookie(pref);
  }
  applyTheme(resolveTheme());
}

/**
 * Toggles between light and dark (always sets an explicit preference).
 */
export function toggleTheme(): void {
  const next: ThemeMode = resolveTheme() === 'dark' ? 'light' : 'dark';
  writeThemeCookie(next);
  applyTheme(next);
}

/**
 * Initializes the theme on page load and listens for system preference changes.
 * Returns a cleanup function.
 */
export function initTheme(): () => void {
  applyTheme(resolveTheme());

  if (typeof window === 'undefined') return () => {};

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleChange = () => {
    if (!readThemeCookie()) {
      applyTheme(resolveTheme());
    }
  };

  mediaQuery.addEventListener('change', handleChange);
  return () => mediaQuery.removeEventListener('change', handleChange);
}

/** @deprecated Use initTheme instead */
export const initializeTheme = initTheme;
