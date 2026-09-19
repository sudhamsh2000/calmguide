/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/**
 * The Expo-template leftovers, re-valued 2026-09-19 to the shared palette
 * (see ThemeContext.tsx, which is the real source of truth for app colour).
 * Kept in sync rather than deleted because a few template-derived components
 * still read from here, and a pure-black/white pair next to the app's
 * near-black/icy-blue one is visibly a different product.
 */
export const Colors = {
  light: {
    text: '#16202C',
    background: '#EEF5FB',
    backgroundElement: '#F3F6F9',
    backgroundSelected: '#E3F0FA',
    textSecondary: '#5D6B7A',
  },
  dark: {
    text: '#E9EDF2',
    background: '#0F1218',
    backgroundElement: '#171B24',
    backgroundSelected: '#1F242E',
    textSecondary: '#9AA7B4',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
