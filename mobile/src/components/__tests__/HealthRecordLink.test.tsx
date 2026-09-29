import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (
      key: string,
      fallback?: string | Record<string, unknown>,
      vars?: Record<string, unknown>,
    ) => {
      const text = typeof fallback === 'string' ? fallback : key;
      const values = (typeof fallback === 'object' ? fallback : vars) ?? {};
      return text.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? `{${name}}`));
    },
  }),
}));

jest.mock('@/components/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      error: '#B84C36',
      primary: '#2B7A78',
      onPrimary: '#FFFFFF',
      success: '#0FA97E',
      surface: '#FFFFFF',
      foreground: '#2D3436',
      mutedForeground: '#636E72',
      border: 'rgba(0,0,0,0.1)',
    },
  }),
}));

const mockApi = {
  getClinicalLink: jest.fn(),
  previewClinicalLink: jest.fn(),
  linkClinicalRecord: jest.fn(),
  testClinicalLink: jest.fn(),
  unlinkClinicalRecord: jest.fn(),
};

jest.mock('@/lib/api', () => {
  class ClinicalLinkError extends Error {
    status: number;
    code: string | null;
    constructor(status: number, code: string | null) {
      super('clinical link error');
      this.status = status;
      this.code = code;
    }
  }
  return {
    ClinicalLinkError,
    getClinicalLink: (...a: unknown[]) => mockApi.getClinicalLink(...a),
    previewClinicalLink: (...a: unknown[]) => mockApi.previewClinicalLink(...a),
    linkClinicalRecord: (...a: unknown[]) => mockApi.linkClinicalRecord(...a),
    testClinicalLink: (...a: unknown[]) => mockApi.testClinicalLink(...a),
    unlinkClinicalRecord: (...a: unknown[]) => mockApi.unlinkClinicalRecord(...a),
  };
});

import { ClinicalLinkError } from '@/lib/api';
import { HealthRecordLink } from '../HealthRecordLink';

const FRANK = 'fba2fc07-8bbd-447b-8aaa-c4b8dfcfec63';
const connected = {
  linked: true,
  source: 'openmrs',
  linked_at: new Date().toISOString(),
  last_synced_at: new Date().toISOString(),
  last_status: 'ok',
  patient_ref_hint: 'ec63',
};

const renderRow = () => render(<HealthRecordLink accessCode="4CDYW4D2" patientName="Frank" />);

beforeEach(() => jest.clearAllMocks());

describe('HealthRecordLink', () => {
  it('shows "Coming soon" when the server has linking switched off', async () => {
    mockApi.getClinicalLink.mockRejectedValue(new ClinicalLinkError(404, 'FEATURE_DISABLED'));
    renderRow();
    expect(await screen.findByText('Coming soon')).toBeOnTheScreen();
    expect(screen.queryByText('Connect')).toBeNull();
  });

  it('links after the caregiver confirms the right person', async () => {
    mockApi.getClinicalLink.mockResolvedValue({ ...connected, linked: false });
    mockApi.previewClinicalLink.mockResolvedValue({ display_name: 'Frank' });
    mockApi.linkClinicalRecord.mockResolvedValue(connected);
    renderRow();

    fireEvent.press(await screen.findByText('Connect'));
    expect(screen.getByText(/Link Frank's record/)).toBeOnTheScreen();
    fireEvent.changeText(screen.getByLabelText('OpenMRS patient ID'), ` ${FRANK.toUpperCase()} `);
    fireEvent.press(screen.getByText('Connect'));

    expect(await screen.findByText('Link to Frank?')).toBeOnTheScreen();
    expect(mockApi.previewClinicalLink).toHaveBeenCalledWith('4CDYW4D2', FRANK);
    expect(mockApi.linkClinicalRecord).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Link'));
    expect(await screen.findByText('Test connection')).toBeOnTheScreen();
    expect(mockApi.linkClinicalRecord).toHaveBeenCalledWith('4CDYW4D2', FRANK);
  });

  it('rejects a malformed ID without calling the server', async () => {
    mockApi.getClinicalLink.mockResolvedValue({ ...connected, linked: false });
    renderRow();
    fireEvent.press(await screen.findByText('Connect'));
    fireEvent.changeText(screen.getByLabelText('OpenMRS patient ID'), 'frank');
    fireEvent.press(screen.getByText('Connect'));
    expect(await screen.findByText('services.openmrs.errors.invalid_id')).toBeOnTheScreen();
    expect(mockApi.previewClinicalLink).not.toHaveBeenCalled();
  });

  it('shows counts after Test connection', async () => {
    mockApi.getClinicalLink.mockResolvedValue(connected);
    mockApi.testClinicalLink.mockResolvedValue({
      status: 'ok',
      conditions: 8,
      medications: 7,
      allergies: 3,
      observations: 7,
    });
    renderRow();
    fireEvent.press(await screen.findByText('Test connection'));
    expect(
      await screen.findByText('Record found: 8 conditions, 7 medications, 3 allergies.'),
    ).toBeOnTheScreen();
  });

  it('asks before disconnecting', async () => {
    mockApi.getClinicalLink.mockResolvedValue(connected);
    mockApi.unlinkClinicalRecord.mockResolvedValue({ ...connected, linked: false });
    renderRow();
    fireEvent.press(await screen.findByText('Disconnect'));
    expect(mockApi.unlinkClinicalRecord).not.toHaveBeenCalled();
    expect(screen.getByText(/Disconnect the health record\?/)).toBeOnTheScreen();
    fireEvent.press(screen.getAllByText('Disconnect')[0]);
    expect(await screen.findByText('Connect')).toBeOnTheScreen();
    expect(mockApi.unlinkClinicalRecord).toHaveBeenCalledWith('4CDYW4D2');
  });
});
