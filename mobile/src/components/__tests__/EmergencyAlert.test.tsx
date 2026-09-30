import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

let mockLanguage = 'en-US';
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { number?: string }) =>
      key === 'emergency_alert.call' ? `Call ${opts?.number}` : key,
    i18n: { language: mockLanguage },
  }),
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Warning: 'warning' },
}));

import { EmergencyAlert } from '../EmergencyAlert';

describe('EmergencyAlert', () => {
  beforeEach(() => {
    mockLanguage = 'en-US';
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders nothing when closed', () => {
    render(<EmergencyAlert open={false} onDismiss={() => {}} />);
    expect(screen.queryByText('emergency_alert.title')).toBeNull();
  });

  it('calls 911 for English', () => {
    render(<EmergencyAlert open onDismiss={() => {}} />);
    fireEvent.press(screen.getByLabelText('Call 911'));
    expect(Linking.openURL).toHaveBeenCalledWith('tel:911');
  });

  it('calls 112 for Hindi', () => {
    mockLanguage = 'hi-IN';
    render(<EmergencyAlert open onDismiss={() => {}} />);
    fireEvent.press(screen.getByLabelText('Call 112'));
    expect(Linking.openURL).toHaveBeenCalledWith('tel:112');
  });

  it('closes only through the explicit dismiss control', () => {
    const onDismiss = jest.fn();
    render(<EmergencyAlert open onDismiss={onDismiss} />);
    fireEvent.press(screen.getByLabelText('emergency_alert.dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
