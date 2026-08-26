import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

// expo-router hooks used by EmergencyBar — return stable, non-tab routes.
jest.mock('expo-router', () => ({
  usePathname: () => '/(tabs)/home',
  useSegments: () => ['(tabs)', 'home'],
}));

// i18n: echo a readable label so we can find the trigger button. For keys with
// a default value we return the default; otherwise the key itself.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

// Theme + safe area: provide the minimal surface EmergencyBar reads.
jest.mock('@/components/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      error: '#B84C36',
      primary: '#2B7A78',
      surface: '#FFFFFF',
      foreground: '#2D3436',
      mutedForeground: '#636E72',
      border: 'rgba(0,0,0,0.1)',
    },
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import { EmergencyBar } from '../EmergencyBar';

describe('EmergencyBar', () => {
  beforeEach(() => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function openModal() {
    // The collapsed trigger uses accessibilityLabel 'Emergency contacts'.
    const triggers = screen.getAllByLabelText('Emergency contacts');
    fireEvent.press(triggers[0]);
  }

  it('renders the 911 and 988 crisis phone numbers once expanded', () => {
    render(<EmergencyBar />);
    openModal();

    expect(screen.getByText('911')).toBeTruthy();
    expect(screen.getByText('988')).toBeTruthy();
  });

  it('dials tel:911 for emergency services', () => {
    render(<EmergencyBar />);
    openModal();

    fireEvent.press(screen.getByText('911'));
    expect(Linking.openURL).toHaveBeenCalledWith('tel:911');
  });

  it('dials tel:988 for the suicide and crisis lifeline', () => {
    render(<EmergencyBar />);
    openModal();

    fireEvent.press(screen.getByText('988'));
    expect(Linking.openURL).toHaveBeenCalledWith('tel:988');
  });

  it('dials the Alzheimer’s Association helpline number', () => {
    render(<EmergencyBar />);
    openModal();

    fireEvent.press(screen.getByText('24/7'));
    expect(Linking.openURL).toHaveBeenCalledWith('tel:18002723900');
  });
});
