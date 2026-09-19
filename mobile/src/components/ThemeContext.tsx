import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

/** Night = 21:00–06:59. Used to auto-darken when the user is on "system". */
function computeIsNightHours(): boolean {
  const h = new Date().getHours();
  return h >= 21 || h < 7;
}

const THEME_PREF_KEY = 'calmguide_theme';
export type ThemePreference = 'light' | 'dark' | 'system';

/**
 * Palette pass, 2026-09-19 — brought in line with the web app and landing
 * page so the two platforms are one product. The previous indigo/teal set
 * is replaced by the same three roles the web uses, with identical hex
 * values (see frontend/src/app/globals.css):
 *
 *   ink   — near-black. The action colour: buttons, active nav, anything
 *           tappable. Nothing that isn't tappable uses it.
 *   sky   — the informational accent: icons, links, chips, tile fills.
 *   coral — a marker only, never a surface or an action.
 *
 * Status colours (success/warning/error) are deliberately left saturated
 * and unchanged. Neutralising everything else is exactly what makes them
 * read as signal on a screen someone is using at 3 a.m.
 */
export const palette = {
  ink: '#10141C',
  inkMuted: '#5D6B7A',
  sky: '#3E8FD0',
  skyDeep: '#2E6FA5',
  skySoft: '#E3F0FA',
  coral: '#E8663D',
  bandFrom: '#10141C',
  bandTo: '#262C38',
  success: '#0FA97E',
  warning: '#F2B441',
} as const;

export const lightColors = {
  primary: palette.ink,
  /** Label on a primary fill. Inverts in dark, same as the web's
   *  --color-on-primary, so a button's text follows its fill. */
  onPrimary: '#FFFFFF',
  primaryText: palette.ink,
  primaryLight: '#262C38',
  primaryDark: '#05070A',
  background: '#EEF5FB',
  surface: '#FFFFFF',
  foreground: '#16202C',
  mutedForeground: palette.inkMuted,
  success: palette.success,
  warning: palette.warning,
  error: '#C4453A',
  border: '#E4EBF2',
  // Extended tokens for the redesign. Screens that predate them keep working;
  // these only add vocabulary the reference layouts need.
  accent: palette.sky,
  accentSoft: palette.skySoft,
  /** Tile fills behind list icons — one neutral-blue family now, not two
   *  competing hues. Names kept because a dozen screens reference them. */
  tileIndigo: palette.skySoft,
  tileTeal: palette.skySoft,
  bandFrom: palette.bandFrom,
  bandTo: palette.bandTo,
  // A single, restrained shadow. Cards lift off the ground rather than sitting
  // in outlined boxes, which is most of what separates this from the old look.
  shadow: 'rgba(16, 20, 28, 0.10)',
  isDark: false,
} as const;

export const darkColors = {
  // Primary inverts: a near-black fill on a near-black ground is not a
  // button. Near-white fill, near-black label — matching the web.
  primary: '#EEF2F7',
  onPrimary: palette.ink,
  primaryText: '#EEF2F7',
  primaryLight: '#FFFFFF',
  primaryDark: '#D5DDE5',
  background: '#0F1218',
  surface: '#171B24',
  foreground: '#E9EDF2',
  mutedForeground: '#9AA7B4',
  success: '#3FCB9F',
  warning: palette.warning,
  error: '#F0937F',
  border: 'rgba(255, 255, 255, 0.12)',
  accent: '#6FB0E6',
  accentSoft: 'rgba(62, 143, 208, 0.18)',
  tileIndigo: 'rgba(62, 143, 208, 0.16)',
  tileTeal: 'rgba(62, 143, 208, 0.16)',
  bandFrom: '#10141C',
  bandTo: '#262C38',
  shadow: 'rgba(0, 0, 0, 0.45)',
  isDark: true,
} as const;

export type AppColors = {
  primary: string;
  /** Label colour for anything sitting on a `primary` fill. */
  onPrimary: string;
  primaryText: string;
  primaryLight: string;
  primaryDark: string;
  background: string;
  surface: string;
  foreground: string;
  mutedForeground: string;
  success: string;
  warning: string;
  error: string;
  border: string;
  /** Sky blue — the informational accent. Not for primary actions. */
  accent: string;
  accentSoft: string;
  /** Soft fills behind list icons. */
  tileIndigo: string;
  tileTeal: string;
  /** Partner band gradient stops. */
  bandFrom: string;
  bandTo: string;
  shadow: string;
  isDark: boolean;
};

interface ThemeContextValue {
  colors: AppColors;
  isDark: boolean;
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
}

const ThemeContext = React.createContext<ThemeContextValue>({
  colors: lightColors,
  isDark: false,
  themePreference: 'system',
  setThemePreference: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');
  // Computed on mount and refreshed on an interval rather than on every render
  // (MOBPERF-15) — calling new Date() per render was wasteful and made the
  // context value unstable.
  const [isNightHours, setIsNightHours] = useState<boolean>(computeIsNightHours);

  useEffect(() => {
    AsyncStorage.getItem(THEME_PREF_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreference(stored);
      }
    });
  }, []);

  useEffect(() => {
    // Re-evaluate the night-hours boundary periodically. 60s granularity is
    // ample for a 21:00/07:00 cutoff and avoids per-render Date() churn.
    const tick = () => setIsNightHours(computeIsNightHours());
    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleSetPreference = useCallback((pref: ThemePreference) => {
    setPreference(pref);
    AsyncStorage.setItem(THEME_PREF_KEY, pref);
  }, []);

  const isDark =
    preference === 'dark'
      ? true
      : preference === 'light'
        ? false
        : systemScheme === 'dark' || isNightHours;
  const colors = isDark ? darkColors : lightColors;

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors,
      isDark,
      themePreference: preference,
      setThemePreference: handleSetPreference,
    }),
    [colors, isDark, preference, handleSetPreference],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  return React.use(ThemeContext);
}
