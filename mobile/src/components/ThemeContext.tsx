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
 * Palette taken from design/references/landing-page/product-screens — the
 * approved product screens. Key values (ink, ground, tile fills, muted copy,
 * partner band) were sampled from those images rather than eyeballed.
 *
 * Three roles, kept distinct on purpose:
 *   ink     — deep navy for headings and body. Carries the "premium" weight;
 *             near-black would read as generic, this reads as considered.
 *   indigo  — the interactive accent: buttons, active nav, icons. Everything
 *             tappable is indigo, and nothing that isn't tappable uses it.
 *   teal    — the brand mark's own colour ("Guide" in the wordmark, the app
 *             icon gradient). Used for brand and affirmative moments, never
 *             for primary actions, so the two never compete.
 */
export const palette = {
  ink: '#061F60',
  inkMuted: '#4C588A',
  indigo: '#5B5BD6',
  indigoDeep: '#4442B8',
  indigoSoft: '#F2F0FE',
  teal: '#2BB3A3',
  tealSoft: '#E4F9F7',
  bandFrom: '#0085AA',
  bandTo: '#12B5A6',
  success: '#0FA97E',
  warning: '#F2B441',
} as const;

export const lightColors = {
  primary: palette.indigo,
  primaryText: palette.indigoDeep,
  primaryLight: '#8B8AE6',
  primaryDark: palette.indigoDeep,
  background: '#F9FAFD',
  surface: '#FFFFFF',
  foreground: palette.ink,
  mutedForeground: palette.inkMuted,
  success: palette.success,
  warning: palette.warning,
  error: '#C4453A',
  border: '#E6EAF4',
  // Extended tokens for the redesign. Screens that predate them keep working;
  // these only add vocabulary the reference layouts need.
  accent: palette.teal,
  accentSoft: palette.tealSoft,
  tileIndigo: palette.indigoSoft,
  tileTeal: palette.tealSoft,
  bandFrom: palette.bandFrom,
  bandTo: palette.bandTo,
  // A single, restrained shadow. Cards lift off the ground rather than sitting
  // in outlined boxes, which is most of what separates this from the old look.
  shadow: 'rgba(6, 31, 96, 0.10)',
  isDark: false,
} as const;

export const darkColors = {
  primary: '#8B8AE6',
  primaryText: '#A5A4F0',
  primaryLight: '#A5A4F0',
  primaryDark: palette.indigo,
  background: '#0A1330',
  surface: '#131E42',
  foreground: '#EEF1FA',
  mutedForeground: '#9AA6CC',
  success: '#3FCB9F',
  warning: palette.warning,
  error: '#F0937F',
  border: 'rgba(255, 255, 255, 0.12)',
  accent: '#4FD1BE',
  accentSoft: 'rgba(43, 179, 163, 0.18)',
  tileIndigo: 'rgba(139, 138, 230, 0.16)',
  tileTeal: 'rgba(79, 209, 190, 0.16)',
  bandFrom: '#00647F',
  bandTo: '#0C8A7F',
  shadow: 'rgba(0, 0, 0, 0.45)',
  isDark: true,
} as const;

export type AppColors = {
  primary: string;
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
  /** Brand teal — the mark's own colour. Not for primary actions. */
  accent: string;
  accentSoft: string;
  /** Pastel fills behind list icons. */
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
