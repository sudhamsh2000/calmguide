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

export const palette = {
  primary: '#2B7A78',
  primaryLight: '#3AAFA9',
  primaryDark: '#17252A',
  success: '#00B894',
  warning: '#FDCB6E',
} as const;

export const lightColors = {
  primary: palette.primary,
  primaryText: palette.primary,
  primaryLight: palette.primaryLight,
  primaryDark: palette.primaryDark,
  background: '#FAFAF5',
  surface: '#FFFFFF',
  foreground: '#2D3436',
  mutedForeground: '#636E72',
  success: palette.success,
  warning: palette.warning,
  error: '#B84C36',
  border: 'rgba(0, 0, 0, 0.1)',
  isDark: false,
} as const;

export const darkColors = {
  primary: palette.primary,
  primaryText: '#3AAFA9',
  primaryLight: palette.primaryLight,
  primaryDark: palette.primaryDark,
  background: '#1A2332',
  surface: '#243447',
  foreground: '#E8E8E8',
  mutedForeground: '#A0AEC0',
  success: palette.success,
  warning: palette.warning,
  error: '#F0937F',
  border: 'rgba(255, 255, 255, 0.1)',
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
    () => ({ colors, isDark, themePreference: preference, setThemePreference: handleSetPreference }),
    [colors, isDark, preference, handleSetPreference],
  );

  return (
    <ThemeContext value={value}>
      {children}
    </ThemeContext>
  );
}

export function useTheme(): ThemeContextValue {
  return React.use(ThemeContext);
}
